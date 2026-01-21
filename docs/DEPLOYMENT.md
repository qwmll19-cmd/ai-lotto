# AI Lotto 배포 가이드

## 목차
1. [사전 요구사항](#사전-요구사항)
2. [환경 설정](#환경-설정)
3. [Docker 배포](#docker-배포)
4. [수동 배포](#수동-배포)
5. [초기 데이터 설정](#초기-데이터-설정)
6. [모니터링](#모니터링)
7. [문제 해결](#문제-해결)

---

## 사전 요구사항

### 시스템 요구사항
- Docker 20.10+ 및 Docker Compose 2.0+
- 또는 Python 3.11+, Node.js 20+, PostgreSQL 15+
- 최소 2GB RAM, 10GB 디스크

### 도메인 및 SSL
- 프로덕션 도메인 준비
- SSL 인증서 (Let's Encrypt 권장)

---

## 환경 설정

### 1. 환경 변수 파일 생성

```bash
# 프로젝트 루트에서
cp .env.example .env
```

### 2. 필수 환경 변수 설정

```bash
# .env 파일 편집
nano .env
```

**필수 설정:**

```env
# 환경 (반드시 prod로 설정)
APP_ENV=prod

# 데이터베이스 (필수)
DB_USER=ai_lotto
DB_PASSWORD=<강력한-비밀번호-설정>

# JWT 시크릿 (필수 - 최소 32자)
# 생성: openssl rand -hex 32
JWT_SECRET=<생성된-시크릿>

# 프론트엔드 도메인 (CORS 설정)
FRONTEND_ORIGINS=https://yourdomain.com

# API URL (프론트엔드 빌드용)
API_BASE_URL=https://api.yourdomain.com
```

**선택 설정:**

```env
# SMS 발송 (실제 서비스 시 필요)
SMS_PROVIDER=coolsms  # 또는 다른 제공자
SMS_API_KEY=<api-key>
SMS_API_SECRET=<api-secret>
SMS_SENDER_ID=<발신번호>

# 관리자 계정
ADMIN_IDENTIFIERS=admin,superuser
```

---

## Docker 배포

### 1. 이미지 빌드 및 실행

```bash
# 프로젝트 루트에서
docker-compose up -d --build
```

### 2. 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 로그 확인
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 3. 헬스 체크

```bash
# Backend API
curl http://localhost:8000/health

# Frontend
curl http://localhost:80/
```

### 4. 서비스 중지/재시작

```bash
# 중지
docker-compose down

# 재시작
docker-compose restart

# 데이터 포함 완전 삭제 (주의!)
docker-compose down -v
```

---

## 수동 배포

Docker 없이 직접 배포하는 경우:

### Backend 배포

```bash
cd backend

# 가상환경 생성
python3 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
export AI_LOTTO_APP_ENV=prod
export AI_LOTTO_DB_URL=postgresql://user:password@localhost:5432/ai_lotto
export JWT_SECRET=$(openssl rand -hex 32)
# ... 기타 환경 변수

# Gunicorn으로 실행
gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 backend.app.main:app
```

### Frontend 배포

```bash
cd react-app

# 의존성 설치
npm ci

# 환경 변수 설정
export VITE_API_BASE_URL=https://api.yourdomain.com

# 빌드
npm run build

# dist 폴더를 Nginx/Apache로 서빙
```

### UI 기준
- 공식 UI는 `react-app/`입니다.
- `frontend/`는 정적 템플릿/초기 기획용으로 유지되며 운영 배포 대상이 아닙니다.

### Nginx 설정 예시

```nginx
# /etc/nginx/sites-available/ai-lotto

# Frontend
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/ai-lotto/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 초기 데이터 설정

### PostgreSQL 스키마 적용

Docker 사용 시 자동으로 적용됩니다. 수동 설정:

```bash
psql -U ai_lotto -d ai_lotto -f db/lotto/schema.sql
```

### 로또 데이터 수집

```bash
# 가상환경 활성화 후
cd /path/to/ai-lotto

# 최근 100회차 데이터 수집
python -m backend.app.scripts.lotto.fetch_draws --start 1000 --end 1150

# 통계 캐시 생성
python -m backend.app.scripts.lotto.build_cache

# 파이프라인 검증
python -m backend.app.scripts.lotto.verify_pipeline
```

---

## DB 마이그레이션

운영 DB를 최신 스키마로 맞추는 방법:
- `docs/DB_MIGRATION.md`

---

## 관리자 설정

관리자 계정 생성/승격은 아래 문서를 따릅니다:
- `docs/ADMIN_SETUP.md`

---

## 운영 체크리스트

배포 이후 점검 항목은 아래 문서를 참고하세요:
- `docs/OPERATIONS_CHECKLIST.md`

---

## 모니터링

### 로그 확인

```bash
# Docker
docker-compose logs -f backend

# 직접 배포
tail -f logs/ai_lotto.log
```

### API 문서

- Swagger UI: `https://api.yourdomain.com/docs`
- ReDoc: `https://api.yourdomain.com/redoc`

### 운영 대시보드

관리자 계정으로 로그인 후 `/lotto/ops` 접속

---

## 문제 해결

### JWT_SECRET 오류

```
ERROR: JWT_SECRET 환경변수가 설정되지 않았습니다.
```

**해결:** `.env` 파일에 JWT_SECRET 설정

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

### 데이터베이스 연결 실패

```
sqlalchemy.exc.OperationalError: could not connect to server
```

**해결:**
1. PostgreSQL 서비스 실행 확인
2. DB_URL 환경 변수 확인
3. 방화벽 설정 확인

### CORS 오류

```
Access to fetch at 'https://api...' from origin 'https://...' has been blocked by CORS policy
```

**해결:** `FRONTEND_ORIGINS` 환경 변수에 프론트엔드 도메인 추가

### Rate Limit 초과

```json
{"detail": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."}
```

**해결:** 정상 동작입니다. 잠시 후 재시도하세요.

- 로그인: 분당 10회
- 회원가입: 분당 5회
- 무료체험: 분당 3회

---

## 보안 체크리스트

배포 전 확인사항:

- [ ] `APP_ENV=prod` 설정
- [ ] `JWT_SECRET` 강력한 값 설정 (32자 이상)
- [ ] `DB_PASSWORD` 강력한 값 설정
- [ ] `FRONTEND_ORIGINS`에 localhost 제거
- [ ] SSL/HTTPS 적용
- [ ] 방화벽 설정 (필요한 포트만 개방)
- [ ] 정기 백업 설정

---

## 업데이트

### 코드 업데이트

```bash
# 최신 코드 가져오기
git pull origin main

# Docker 재빌드
docker-compose up -d --build
```

### 데이터베이스 마이그레이션

현재 자동 마이그레이션 지원. 필요시 수동:

```bash
# 백업 먼저!
docker-compose exec db pg_dump -U ai_lotto ai_lotto > backup.sql

# 스키마 변경 적용
docker-compose exec db psql -U ai_lotto -d ai_lotto -f /path/to/migration.sql
```

---

## 지원

문제 발생 시:
1. 로그 확인
2. 환경 변수 확인
3. GitHub Issues 등록
