import { useState } from 'react'
import AdminPagination from './AdminPagination.jsx'
import EmptyTableRow from './EmptyTableRow.jsx'

function LottoTab({ lottoDraws, newDraw, setNewDraw, loadLottoDraws, handleCreateDraw, handleDeleteDraw, handleUpdateDraw, handleRebuildCache }) {
  const [editingDraw, setEditingDraw] = useState(null)
  const [editData, setEditData] = useState({})

  const startEdit = (draw) => {
    setEditingDraw(draw.draw_no)
    setEditData({
      draw_date: draw.draw_date,
      n1: draw.n1,
      n2: draw.n2,
      n3: draw.n3,
      n4: draw.n4,
      n5: draw.n5,
      n6: draw.n6,
      bonus: draw.bonus,
    })
  }

  const cancelEdit = () => {
    setEditingDraw(null)
    setEditData({})
  }

  const saveEdit = (drawNo) => {
    const data = {
      draw_date: editData.draw_date,
      n1: parseInt(editData.n1),
      n2: parseInt(editData.n2),
      n3: parseInt(editData.n3),
      n4: parseInt(editData.n4),
      n5: parseInt(editData.n5),
      n6: parseInt(editData.n6),
      bonus: parseInt(editData.bonus),
    }
    // 유효성 검사
    const numbers = [data.n1, data.n2, data.n3, data.n4, data.n5, data.n6, data.bonus]
    if (numbers.some((n) => n < 1 || n > 45)) {
      alert('번호는 1~45 사이여야 합니다.')
      return
    }
    const mainNumbers = [data.n1, data.n2, data.n3, data.n4, data.n5, data.n6]
    if (new Set(mainNumbers).size !== 6) {
      alert('당첨 번호에 중복이 있습니다.')
      return
    }
    handleUpdateDraw(drawNo, data)
    setEditingDraw(null)
    setEditData({})
  }

  return (
    <div className="admin__lotto">
      <div className="admin__toolbar">
        <button className="admin__btn admin__btn--primary" onClick={handleRebuildCache}>
          캐시 재생성
        </button>
      </div>

      <div className="admin__form-section">
        <h3>새 회차 추가</h3>
        <form className="admin__add-draw" onSubmit={handleCreateDraw}>
          <input
            type="number"
            placeholder="회차"
            value={newDraw.draw_no}
            onChange={(e) => setNewDraw({ ...newDraw, draw_no: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="날짜 (YYYY-MM-DD)"
            value={newDraw.draw_date}
            onChange={(e) => setNewDraw({ ...newDraw, draw_date: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="1번"
            min="1"
            max="45"
            value={newDraw.n1}
            onChange={(e) => setNewDraw({ ...newDraw, n1: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="2번"
            min="1"
            max="45"
            value={newDraw.n2}
            onChange={(e) => setNewDraw({ ...newDraw, n2: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="3번"
            min="1"
            max="45"
            value={newDraw.n3}
            onChange={(e) => setNewDraw({ ...newDraw, n3: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="4번"
            min="1"
            max="45"
            value={newDraw.n4}
            onChange={(e) => setNewDraw({ ...newDraw, n4: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="5번"
            min="1"
            max="45"
            value={newDraw.n5}
            onChange={(e) => setNewDraw({ ...newDraw, n5: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="6번"
            min="1"
            max="45"
            value={newDraw.n6}
            onChange={(e) => setNewDraw({ ...newDraw, n6: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="보너스"
            min="1"
            max="45"
            value={newDraw.bonus}
            onChange={(e) => setNewDraw({ ...newDraw, bonus: e.target.value })}
            required
          />
          <button type="submit" className="admin__btn admin__btn--primary">
            추가
          </button>
        </form>
      </div>

      <table className="admin__table">
        <thead>
          <tr>
            <th>회차</th>
            <th>날짜</th>
            <th>번호</th>
            <th>보너스</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {lottoDraws.draws.length === 0 ? (
            <EmptyTableRow colSpan={5} message="로또 데이터가 없습니다." />
          ) : (
            lottoDraws.draws.map((draw) => (
              <tr key={draw.draw_no}>
                <td>{draw.draw_no}</td>
                <td>
                  {editingDraw === draw.draw_no ? (
                    <input
                      type="text"
                      value={editData.draw_date}
                      onChange={(e) => setEditData({ ...editData, draw_date: e.target.value })}
                      style={{ width: '100px' }}
                    />
                  ) : (
                    draw.draw_date
                  )}
                </td>
                <td>
                  {editingDraw === draw.draw_no ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((key) => (
                        <input
                          key={key}
                          type="number"
                          min="1"
                          max="45"
                          value={editData[key]}
                          onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                          style={{ width: '40px' }}
                        />
                      ))}
                    </div>
                  ) : (
                    `${draw.n1}, ${draw.n2}, ${draw.n3}, ${draw.n4}, ${draw.n5}, ${draw.n6}`
                  )}
                </td>
                <td>
                  {editingDraw === draw.draw_no ? (
                    <input
                      type="number"
                      min="1"
                      max="45"
                      value={editData.bonus}
                      onChange={(e) => setEditData({ ...editData, bonus: e.target.value })}
                      style={{ width: '40px' }}
                    />
                  ) : (
                    draw.bonus
                  )}
                </td>
                <td>
                  {editingDraw === draw.draw_no ? (
                    <>
                      <button className="admin__btn admin__btn--primary" onClick={() => saveEdit(draw.draw_no)}>
                        저장
                      </button>
                      <button className="admin__btn" onClick={cancelEdit}>
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="admin__btn" onClick={() => startEdit(draw)}>
                        수정
                      </button>
                      <button className="admin__btn admin__btn--danger" onClick={() => handleDeleteDraw(draw.draw_no)}>
                        삭제
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <AdminPagination
        page={lottoDraws.page}
        total={lottoDraws.total}
        pageSize={lottoDraws.page_size}
        onPageChange={loadLottoDraws}
      />
    </div>
  )
}

export default LottoTab
