"""통계 기반 로또 ML 학습 모듈 (XGBoost 대체)"""
import pickle
from pathlib import Path
from collections import defaultdict, Counter
from typing import List, Dict, Tuple
import numpy as np
from app.services.lotto.stats_calculator import LottoStatsCalculator


class LottoMLTrainer:
    """로또 ML 모델 학습"""

    def __init__(self, model_path: str = None):
        self.model_path = model_path or str(Path(__file__).parent / "lotto_ml_model.pkl")
        self.model = None
        self.feature_importance = None
        self.ai_weights = {'logic1': 0.33, 'logic2': 0.33, 'logic3': 0.34}

    def extract_features(self, draws: List[Dict], target_draw_no: int, number: int) -> List[float]:
        """
        특정 회차, 특정 번호의 특성 추출

        Args:
            draws: 전체 회차 데이터 (1회~현재까지)
            target_draw_no: 예측 대상 회차
            number: 예측 대상 번호 (1~45)

        Returns:
            15개 특성 리스트 (logic4 추가)
        """
        # 이전 회차만 사용 (target_draw_no 이전 데이터로 학습)
        past_draws = [d for d in draws if d['draw_no'] < target_draw_no]

        if len(past_draws) < 10:
            # 데이터 부족 시 기본값 반환
            return [0.0] * 15

        # 4가지 로직 점수 계산
        scores_logic1 = LottoStatsCalculator.calculate_ai_scores_logic1(past_draws)
        scores_logic2 = LottoStatsCalculator.calculate_ai_scores_logic2(past_draws)
        scores_logic3 = LottoStatsCalculator.calculate_ai_scores_logic3(past_draws)
        scores_logic4 = LottoStatsCalculator.calculate_ai_scores_logic4(past_draws)

        # 전체 출현 빈도
        total_count = Counter()
        for d in past_draws:
            for n in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
                total_count[n] += 1

        # 최근 10회 출현
        recent_10 = past_draws[-10:] if len(past_draws) >= 10 else past_draws
        recent10_count = Counter()
        for d in recent_10:
            for n in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
                recent10_count[n] += 1

        # 최근 30회 출현
        recent_30 = past_draws[-30:] if len(past_draws) >= 30 else past_draws
        recent30_count = Counter()
        for d in recent_30:
            for n in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
                recent30_count[n] += 1

        # 최근 100회 출현
        recent_100 = past_draws[-100:] if len(past_draws) >= 100 else past_draws
        recent100_count = Counter()
        for d in recent_100:
            for n in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
                recent100_count[n] += 1

        # 마지막 출현 이후 간격
        last_appear = 0
        for i, d in enumerate(past_draws, 1):
            if number in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
                last_appear = i
        gap = len(past_draws) - last_appear if last_appear > 0 else 999

        # HOT/COLD 번호
        most_common, least_common = LottoStatsCalculator.calculate_most_least(past_draws, 15)
        is_hot = 1.0 if number in most_common else 0.0
        is_cold = 1.0 if number in least_common else 0.0

        # 보너스 번호 출현 빈도
        bonus_count = sum(1 for d in past_draws if d.get('bonus') == number)

        # 홀짝
        odd_even = 1.0 if number % 2 == 1 else 0.0

        # 구간 (0=1~15, 1=16~30, 2=31~45)
        if 1 <= number <= 15:
            zone = 0.0
        elif 16 <= number <= 30:
            zone = 1.0
        else:
            zone = 2.0

        # 최근 연속 출현
        consecutive_streak = 0
        for d in reversed(past_draws):
            if number in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
                consecutive_streak += 1
            else:
                break

        # 15개 특성 반환 (logic4 추가)
        return [
            scores_logic1.get(number, 0.0),      # 0: logic1 점수
            scores_logic2.get(number, 0.0),      # 1: logic2 점수
            scores_logic3.get(number, 0.0),      # 2: logic3 점수
            scores_logic4.get(number, 0.0),      # 3: logic4 점수 (ML 전체 학습)
            float(total_count.get(number, 0)),   # 4: 전체 출현 빈도
            float(recent10_count.get(number, 0)), # 5: 최근 10회 출현
            float(recent30_count.get(number, 0)), # 6: 최근 30회 출현
            float(recent100_count.get(number, 0)), # 7: 최근 100회 출현
            float(gap),                          # 8: 마지막 출현 이후 간격
            is_hot,                              # 9: HOT 번호 여부
            is_cold,                             # 10: COLD 번호 여부
            float(bonus_count),                  # 11: 보너스 출현 횟수
            odd_even,                            # 12: 홀짝
            zone,                                # 13: 구간
            float(consecutive_streak)            # 14: 연속 출현
        ]

    def prepare_training_data(self, draws: List[Dict], start_draw: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """
        학습 데이터 준비

        Args:
            draws: 전체 회차 데이터
            start_draw: 학습 시작 회차 (기본 100회부터)

        Returns:
            X (features), y (labels)
        """
        X = []
        y = []

        # 100회차부터 최신 회차까지 학습
        for draw in draws:
            if draw['draw_no'] < start_draw:
                continue

            target_numbers = {draw['n1'], draw['n2'], draw['n3'], draw['n4'], draw['n5'], draw['n6']}

            # 각 번호(1~45)마다 특성 추출
            for number in range(1, 46):
                features = self.extract_features(draws, draw['draw_no'], number)
                label = 1 if number in target_numbers else 0

                X.append(features)
                y.append(label)

        return np.array(X), np.array(y)

    def train(self, draws: List[Dict], test_size: float = 0.2) -> Dict:
        """
        통계 기반 모델 학습 (특성 중요도 자동 계산)

        Args:
            draws: 전체 회차 데이터
            test_size: 테스트 데이터 비율

        Returns:
            학습 결과 (정확도, 특성 중요도, 가중치 등)
        """
        print("📊 학습 데이터 준비 중...")

        # 최근 200회차로 특성 중요도 분석
        recent_draws = draws[-200:] if len(draws) > 200 else draws

        # 14개 특성의 예측 정확도 측정
        feature_scores = self._calculate_feature_importance(recent_draws)

        self.feature_importance = feature_scores
        self.model = "statistical"  # 통계 모델 마커

        # 평가 (간단한 hit rate)
        train_acc, test_acc = self._evaluate_model(recent_draws)

        print(f"✅ 학습 완료!")
        print(f"   Train 정확도: {train_acc:.4f}")
        print(f"   Test 정확도: {test_acc:.4f}")

        feature_names = [
            'logic1_score', 'logic2_score', 'logic3_score', 'logic4_score',
            'total_freq', 'recent10_freq', 'recent30_freq', 'recent100_freq',
            'gap', 'is_hot', 'is_cold', 'bonus_freq', 'odd_even', 'zone', 'consecutive'
        ]

        print("\n📈 특성 중요도 (상위 10개):")
        importance_dict = dict(zip(feature_names, feature_scores))
        sorted_importance = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
        for name, score in sorted_importance[:10]:
            print(f"   {name:20s}: {score:.4f}")

        # 4가지 로직 가중치 자동 조정
        logic_importance_sum = feature_scores[0] + feature_scores[1] + feature_scores[2] + feature_scores[3]
        if logic_importance_sum > 0:
            self.ai_weights = {
                'logic1': float(feature_scores[0] / logic_importance_sum),
                'logic2': float(feature_scores[1] / logic_importance_sum),
                'logic3': float(feature_scores[2] / logic_importance_sum),
                'logic4': float(feature_scores[3] / logic_importance_sum)
            }

        print(f"\n🎯 AI 로직 가중치 (자동 조정):")
        print(f"   Logic1: {self.ai_weights['logic1']:.4f}")
        print(f"   Logic2: {self.ai_weights['logic2']:.4f}")
        print(f"   Logic3: {self.ai_weights['logic3']:.4f}")
        print(f"   Logic4: {self.ai_weights['logic4']:.4f} ← ML 전체 학습")

        # 모델 저장
        self.save_model()

        return {
            'train_accuracy': train_acc,
            'test_accuracy': test_acc,
            'feature_importance': importance_dict,
            'ai_weights': self.ai_weights,
            'total_samples': len(recent_draws),
            'train_samples': int(len(recent_draws) * 0.8),
            'test_samples': int(len(recent_draws) * 0.2)
        }

    def _calculate_feature_importance(self, draws: List[Dict]) -> np.ndarray:
        """
        특성별 예측 정확도 측정 (최근 회차 기준)

        각 특성이 다음 회차 예측에 얼마나 기여하는지 측정
        """
        feature_hits = [0.0] * 15  # 15개 특성 (logic4 추가)

        # 최근 50회차로 평가
        eval_draws = draws[-50:] if len(draws) > 50 else draws

        for i, draw in enumerate(eval_draws):
            if i == 0:
                continue  # 첫 회차는 이전 데이터 없음

            actual_numbers = {draw['n1'], draw['n2'], draw['n3'], draw['n4'], draw['n5'], draw['n6']}

            # 이전 회차들로 특성 계산
            past_draws = draws[:draws.index(draw)]

            # 각 번호의 특성 추출
            number_features = {}
            for num in range(1, 46):
                features = self.extract_features(past_draws, draw['draw_no'], num)
                number_features[num] = features

            # 특성별로 상위 15개 번호가 실제 당첨 번호와 얼마나 겹치는지 측정
            for feat_idx in range(15):
                # 이 특성 기준 상위 15개 번호
                sorted_nums = sorted(
                    number_features.items(),
                    key=lambda x: x[1][feat_idx],
                    reverse=True
                )
                top_15 = {num for num, _ in sorted_nums[:15]}

                # 실제 당첨 번호와 겹치는 개수
                hits = len(top_15 & actual_numbers)
                feature_hits[feat_idx] += hits / 6.0  # 0~1 정규화

        # 평균 hit rate
        feature_scores = np.array(feature_hits) / len(eval_draws)

        # Logic4 가중치 부스팅 (ML 전체 학습 강화)
        feature_scores[3] *= 1.5  # Logic4 50% 증가

        # 정규화 (합이 1이 되도록)
        total = feature_scores.sum()
        if total > 0:
            feature_scores = feature_scores / total

        return feature_scores

    def _evaluate_model(self, draws: List[Dict]) -> Tuple[float, float]:
        """간단한 모델 평가"""
        # 학습: 최근 80%, 테스트: 최근 20%
        split_idx = int(len(draws) * 0.8)
        train_draws = draws[:split_idx]
        test_draws = draws[split_idx:]

        train_acc = self._calculate_hit_rate(train_draws)
        test_acc = self._calculate_hit_rate(test_draws)

        return train_acc, test_acc

    def _calculate_hit_rate(self, draws: List[Dict]) -> float:
        """Hit rate 계산 (3개 로직 종합 점수 기준)"""
        if len(draws) < 10:
            return 0.0

        hits = 0
        total = 0

        for i in range(10, len(draws)):
            past_draws = draws[:i]
            current_draw = draws[i]

            actual_numbers = {
                current_draw['n1'], current_draw['n2'], current_draw['n3'],
                current_draw['n4'], current_draw['n5'], current_draw['n6']
            }

            # 4가지 로직 점수 계산
            scores1 = LottoStatsCalculator.calculate_ai_scores_logic1(past_draws)
            scores2 = LottoStatsCalculator.calculate_ai_scores_logic2(past_draws)
            scores3 = LottoStatsCalculator.calculate_ai_scores_logic3(past_draws)
            scores4 = LottoStatsCalculator.calculate_ai_scores_logic4(past_draws)

            # 종합 점수
            final_scores = {}
            for n in range(1, 46):
                final_scores[n] = (
                    scores1.get(n, 0) * self.ai_weights.get('logic1', 0.25) +
                    scores2.get(n, 0) * self.ai_weights.get('logic2', 0.25) +
                    scores3.get(n, 0) * self.ai_weights.get('logic3', 0.25) +
                    scores4.get(n, 0) * self.ai_weights.get('logic4', 0.25)
                )

            # 상위 15개
            top_15 = set([num for num, _ in sorted(final_scores.items(), key=lambda x: x[1], reverse=True)[:15]])

            # Hit 계산
            hits += len(top_15 & actual_numbers)
            total += 6

        return hits / total if total > 0 else 0.0

    def predict_proba(self, draws: List[Dict], target_draw_no: int) -> Dict[int, float]:
        """
        다음 회차 각 번호의 출현 확률 예측 (특성 가중합)

        Args:
            draws: 전체 회차 데이터
            target_draw_no: 예측 대상 회차

        Returns:
            {번호: 출현확률} 딕셔너리
        """
        if self.model is None:
            self.load_model()

        predictions = {}

        for number in range(1, 46):
            features = self.extract_features(draws, target_draw_no, number)

            # 특성 중요도 기반 가중합
            score = sum(f * w for f, w in zip(features, self.feature_importance))

            predictions[number] = float(score)

        # 0~1로 정규화
        min_score = min(predictions.values())
        max_score = max(predictions.values())
        score_range = max_score - min_score

        if score_range > 0:
            for num in predictions:
                predictions[num] = (predictions[num] - min_score) / score_range

        return predictions

    def save_model(self):
        """모델 저장"""
        model_data = {
            'model': self.model,
            'feature_importance': self.feature_importance,
            'ai_weights': self.ai_weights
        }

        with open(self.model_path, 'wb') as f:
            pickle.dump(model_data, f)

        print(f"\n💾 모델 저장 완료: {self.model_path}")

    def load_model(self):
        """모델 로드"""
        try:
            with open(self.model_path, 'rb') as f:
                model_data = pickle.load(f)

            self.model = model_data['model']
            self.feature_importance = model_data['feature_importance']
            self.ai_weights = model_data['ai_weights']

            print(f"✅ 모델 로드 완료: {self.model_path}")
            return True
        except FileNotFoundError:
            print(f"⚠️ 모델 파일 없음: {self.model_path}")
            return False

    def get_ai_weights(self) -> Dict[str, float]:
        """AI 가중치 반환"""
        if self.model is None:
            self.load_model()

        return self.ai_weights

    def get_model_status(self) -> Dict:
        """
        모델 상태 조회

        Returns:
            - is_loaded: 모델 로드 여부
            - model_path: 모델 파일 경로
            - ai_weights: 현재 가중치
            - feature_importance: 특성 중요도
            - model_exists: 모델 파일 존재 여부
        """
        model_exists = Path(self.model_path).exists()
        is_loaded = self.model is not None

        return {
            "is_loaded": is_loaded,
            "model_path": self.model_path,
            "model_exists": model_exists,
            "ai_weights": self.ai_weights if is_loaded else None,
            "feature_importance": (
                self.feature_importance.tolist() if is_loaded and self.feature_importance is not None
                else None
            ),
        }

    def backtest(self, draws: List[Dict], test_draws: int = 20) -> Dict:
        """
        백테스트 수행 (최근 N회차 예측 정확도 검증)

        Args:
            draws: 전체 회차 데이터
            test_draws: 테스트 회차 수 (기본 20)

        Returns:
            - test_results: 각 회차별 테스트 결과
            - overall_accuracy: 전체 정확도
            - top10_hit_rate: 상위 10개 중 적중률
            - top15_hit_rate: 상위 15개 중 적중률
            - top20_hit_rate: 상위 20개 중 적중률
        """
        if len(draws) < test_draws + 50:
            return {"error": "데이터가 충분하지 않습니다."}

        test_results = []
        total_top10_hits = 0
        total_top15_hits = 0
        total_top20_hits = 0
        total_draws_tested = 0

        # 최근 test_draws 회차에 대해 백테스트
        for i in range(len(draws) - test_draws, len(draws)):
            draw = draws[i]
            past_draws = draws[:i]

            if len(past_draws) < 50:
                continue

            actual_numbers = {draw['n1'], draw['n2'], draw['n3'], draw['n4'], draw['n5'], draw['n6']}

            # 예측 수행
            predictions = self.predict_proba(past_draws, draw['draw_no'])

            # 상위 N개 추출
            sorted_preds = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
            top_10 = {n for n, _ in sorted_preds[:10]}
            top_15 = {n for n, _ in sorted_preds[:15]}
            top_20 = {n for n, _ in sorted_preds[:20]}

            # 적중 계산
            hit_10 = len(top_10 & actual_numbers)
            hit_15 = len(top_15 & actual_numbers)
            hit_20 = len(top_20 & actual_numbers)

            total_top10_hits += hit_10
            total_top15_hits += hit_15
            total_top20_hits += hit_20
            total_draws_tested += 1

            test_results.append({
                "draw_no": draw['draw_no'],
                "actual": list(actual_numbers),
                "top_10_predicted": [n for n, _ in sorted_preds[:10]],
                "hit_10": hit_10,
                "hit_15": hit_15,
                "hit_20": hit_20,
            })

        # 평균 적중률 계산
        avg_top10 = total_top10_hits / total_draws_tested if total_draws_tested > 0 else 0
        avg_top15 = total_top15_hits / total_draws_tested if total_draws_tested > 0 else 0
        avg_top20 = total_top20_hits / total_draws_tested if total_draws_tested > 0 else 0

        return {
            "test_results": test_results,
            "total_tested": total_draws_tested,
            "top10_hit_rate": round(avg_top10, 3),
            "top15_hit_rate": round(avg_top15, 3),
            "top20_hit_rate": round(avg_top20, 3),
            "top10_hit_percent": round(avg_top10 / 6 * 100, 2),
            "top15_hit_percent": round(avg_top15 / 6 * 100, 2),
            "top20_hit_percent": round(avg_top20 / 6 * 100, 2),
        }

    def get_prediction_report(self, draws: List[Dict], target_draw_no: int) -> Dict:
        """
        예측 리포트 생성

        Returns:
            - predicted_numbers: 추천 번호 (상위 15개)
            - confidence_scores: 각 번호별 신뢰도
            - analysis: 분석 코멘트
        """
        predictions = self.predict_proba(draws, target_draw_no)

        sorted_preds = sorted(predictions.items(), key=lambda x: x[1], reverse=True)

        # 상위 15개 추출
        top_15 = [(n, round(score, 4)) for n, score in sorted_preds[:15]]

        # 분석 코멘트 생성
        hot_numbers = [n for n, s in top_15[:6]]  # 상위 6개
        analysis = []

        # 구간별 분포 분석
        zone_1 = [n for n in hot_numbers if 1 <= n <= 15]
        zone_2 = [n for n in hot_numbers if 16 <= n <= 30]
        zone_3 = [n for n in hot_numbers if 31 <= n <= 45]

        if len(zone_2) >= 3:
            analysis.append("중간 구간(16~30) 번호가 강세입니다.")
        if len(zone_1) >= 3:
            analysis.append("낮은 구간(1~15) 번호가 활발합니다.")
        if len(zone_3) >= 3:
            analysis.append("높은 구간(31~45) 번호가 주목됩니다.")

        # 홀짝 분석
        odd_count = sum(1 for n in hot_numbers if n % 2 == 1)
        if odd_count >= 4:
            analysis.append("홀수 번호 출현이 예상됩니다.")
        elif odd_count <= 2:
            analysis.append("짝수 번호 출현이 예상됩니다.")
        else:
            analysis.append("홀짝 균형이 예상됩니다.")

        return {
            "target_draw_no": target_draw_no,
            "predicted_numbers": [n for n, _ in top_15],
            "confidence_scores": {n: s for n, s in top_15},
            "hot_6": hot_numbers,
            "analysis": analysis,
            "ai_weights": self.ai_weights,
        }
