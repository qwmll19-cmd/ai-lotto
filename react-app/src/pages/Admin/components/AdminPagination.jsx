/**
 * Admin 페이지 공통 페이지네이션 컴포넌트
 */
function AdminPagination({ page, total, pageSize, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <div className="admin__pagination">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        이전
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        다음
      </button>
    </div>
  )
}

export default AdminPagination
