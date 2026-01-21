export function initForm() {
  const form = document.getElementById('lotto-form');
  const result = document.getElementById('form-result');
  if (!form || !result) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.disabled = true;
    result.textContent = '신청을 처리 중입니다...';

    const payload = {
      name: form.querySelector("[name='name']")?.value?.trim(),
      phone: form.querySelector("[name='phone']")?.value?.trim(),
      combo_count: Number(form.querySelector("[name='combo_count']")?.value || 20),
      consent_terms: Boolean(form.querySelector("[name='consent_terms']")?.checked),
      consent_marketing: Boolean(form.querySelector("[name='consent_marketing']")?.checked),
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/api/apply-free-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || '요청에 실패했습니다.');
      }

      result.textContent = '신청이 완료되었습니다. AI 추천 번호는 문자로 발송됩니다.';
    } catch (error) {
      result.textContent = `에러: ${error.message || '요청에 실패했습니다.'}`;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
