/**
 * Admin 테이블 공통 빈 상태 행 컴포넌트
 */
function EmptyTableRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', color: '#888' }}>
        {message}
      </td>
    </tr>
  )
}

export default EmptyTableRow
