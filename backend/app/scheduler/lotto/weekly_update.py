"""매주 토요일 20:45 자동 업데이트"""
import json
from datetime import datetime, timedelta

from sqlalchemy import text

from app.utils import now_kst

from app.collectors.lotto.api_client import LottoAPIClient
from app.collectors.lotto.db_manager import LottoDBManager
from app.services.lotto.stats_calculator import LottoStatsCalculator
from app.services.lotto.result_matcher import match_all_pending_logs, get_plan_performance_summary
from app.services.lotto.ml_trainer import LottoMLTrainer
from app.services.notification_service import NotificationService
from app.db.session import SessionLocal
from app.db.models import MLTrainingLog, WebPushSubscription, User


async def weekly_lotto_update(session_factory=SessionLocal, bot=None, admin_chat_id=None):
    """
    주간 로또 업데이트

    1. 최신 회차 수집
    2. 당첨 결과 매칭
    3. 푸시 알림 브로드캐스트 (신규 회차 발표 시)
    4. ML 재학습
    5. 통계 캐시 갱신
    6. 관리자에게 알림

    Args:
        session_factory: DB 세션 팩토리
        bot: telegram bot instance
        admin_chat_id: 관리자 chat ID
    """
    try:
        print(f"\n{'='*60}")
        print(f"[{now_kst()}] 주간 로또 업데이트 시작")
        print(f"{'='*60}")

        with session_factory() as db:
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # [1/5] 최신 회차 수집
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            api_client = LottoAPIClient(delay=0.5)
            db_manager = LottoDBManager(db)

            latest_api = api_client.get_latest_draw_no()
            latest_db = db_manager.get_max_draw_no() or 0

            print(f"   API 최신 회차: {latest_api}")
            print(f"   DB 최신 회차: {latest_db}")

            # 신규 회차 수집
            new_count = 0
            new_draw_no = None

            if latest_api > latest_db:
                print(f"   신규 회차 수집 중... ({latest_db + 1}~{latest_api})")
                for draw_no in range(latest_db + 1, latest_api + 1):
                    draw_info = api_client.get_lotto_draw(draw_no, retries=3)
                    if draw_info is None:
                        print(f"   ⚠️  회차 {draw_no} 데이터 아직 없음 (다음 주 재시도)")
                        if bot and admin_chat_id:
                            await bot.send_message(
                                chat_id=admin_chat_id,
                                text=f"⚠️ 회차 {draw_no} 수집 실패 (다음 주 재시도)",
                            )
                        continue

                    saved = db_manager.save_draw(draw_info)
                    if saved:
                        new_count += 1
                        new_draw_no = draw_no
                        print(f"   ✅ 회차 {draw_no} 저장 완료")
            else:
                print("   ℹ️  신규 회차 없음")

            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # [2/6] 당첨 결과 매칭
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            match_result = None
            latest_draw_info = None
            if new_draw_no:
                print(f"   당첨 결과 매칭 중... (회차 {new_draw_no})")
                match_result = match_all_pending_logs(db, new_draw_no)
                print(f"   ✅ {match_result.get('matched_count', 0)}개 로그 매칭 완료")

                # 최신 회차 정보 저장 (푸시 알림용)
                latest_draw_info = api_client.get_lotto_draw(new_draw_no)

            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # [3/6] 푸시 알림 브로드캐스트 (새 회차 발표 알림)
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            push_result = None
            if new_draw_no:
                print("   푸시 알림 전송 중...")
                try:
                    # 새 회차 발표 알림 (당첨 결과 확인 유도)
                    push_result = NotificationService.broadcast_new_draw_announcement(
                        db=db,
                        draw_no=new_draw_no,
                    )
                    print(f"   ✅ 푸시 알림 전송: {push_result.get('sent', 0)}건 성공, {push_result.get('user_count', 0)}명")
                except Exception as push_error:
                    print(f"   ⚠️  푸시 알림 실패: {push_error}")
            else:
                print("   ℹ️  푸시 알림 스킵 (신규 회차 없음)")

            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # [4/6] ML 재학습
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            print("   ML 모델 재학습 중...")
            draws = db_manager.get_recent_draws(n=10000)
            draws.reverse()

            draws_dict = [
                {
                    "draw_no": d["draw_no"],
                    "n1": d["n1"], "n2": d["n2"], "n3": d["n3"],
                    "n4": d["n4"], "n5": d["n5"], "n6": d["n6"],
                    "bonus": d["bonus"],
                }
                for d in draws
            ]

            trainer = LottoMLTrainer()
            train_result = trainer.train(draws_dict)

            # 학습 로그 저장
            plan_perf = get_plan_performance_summary(db, recent_draws=10)
            ml_log = MLTrainingLog(
                total_draws=len(draws_dict),
                total_feedback_records=match_result.get("matched_count", 0) if match_result else 0,
                train_accuracy=train_result.get("train_accuracy"),
                test_accuracy=train_result.get("test_accuracy"),
                weight_logic1=train_result.get("ai_weights", {}).get("logic1"),
                weight_logic2=train_result.get("ai_weights", {}).get("logic2"),
                weight_logic3=train_result.get("ai_weights", {}).get("logic3"),
                weight_logic4=train_result.get("ai_weights", {}).get("logic4"),
                plan_performance=plan_perf,
                notes=f"자동 학습 - 회차 {new_draw_no}" if new_draw_no else "자동 학습"
            )
            db.add(ml_log)
            db.commit()

            print(f"   ✅ ML 재학습 완료 (정확도: {train_result.get('test_accuracy', 0):.4f})")

            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # [5/6] 통계 캐시 갱신
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            print("   통계 캐시 갱신 중...")

            calculator = LottoStatsCalculator()
            most, least = calculator.calculate_most_least(draws_dict)
            ai_scores = calculator.calculate_ai_scores(draws_dict)

            query = text(
                """
                INSERT INTO lotto_stats_cache (id, updated_at, total_draws, most_common, least_common, ai_scores)
                VALUES (1, :updated_at, :total_draws, :most_common, :least_common, :ai_scores)
                ON CONFLICT (id) DO UPDATE SET
                    updated_at = :updated_at,
                    total_draws = :total_draws,
                    most_common = :most_common,
                    least_common = :least_common,
                    ai_scores = :ai_scores
                """
            )
            db.execute(
                query,
                {
                    "updated_at": now_kst(),
                    "total_draws": len(draws_dict),
                    "most_common": json.dumps(most),
                    "least_common": json.dumps(least),
                    "ai_scores": json.dumps(ai_scores),
                },
            )
            db.commit()
            print("   ✅ 통계 캐시 갱신 완료")

            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # [6/6] 관리자에게 알림
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            current_db_max = db_manager.get_max_draw_no()

            # 플랜별 성과 요약
            perf_msg = ""
            if plan_perf:
                perf_msg = "\n\n📊 최근 10회 플랜별 성과:"
                for plan, stats in plan_perf.items():
                    perf_msg += f"\n  {plan}: 평균 {stats.get('avg_match', 0):.1f}개 적중"

            # 푸시 알림 결과 메시지
            push_msg = ""
            if push_result:
                push_msg = f"\n📲 푸시 알림: {push_result.get('sent', 0)}건 → {push_result.get('user_count', 0)}명"

            msg = (
                f"✅ 로또 데이터 업데이트 완료\n\n"
                f"📌 최신 회차: {current_db_max}회\n"
                f"📥 신규 수집: {new_count}개\n"
                f"🎯 매칭 완료: {match_result.get('matched_count', 0) if match_result else 0}건\n"
                f"🤖 ML 정확도: {train_result.get('test_accuracy', 0):.4f}"
                f"{push_msg}\n"
                f"🕐 갱신 시간: {now_kst().strftime('%Y-%m-%d %H:%M:%S')}"
                f"{perf_msg}"
            )

            if bot and admin_chat_id:
                await bot.send_message(chat_id=admin_chat_id, text=msg)

        print(f"[{now_kst()}] 주간 로또 업데이트 완료")
        print(f"{'='*60}\n")

    except Exception as e:
        error_msg = f"❌ 로또 업데이트 실패: {e}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        try:
            if bot and admin_chat_id:
                await bot.send_message(chat_id=admin_chat_id, text=error_msg)
        except Exception:
            pass
