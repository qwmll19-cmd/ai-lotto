import { useState } from 'react'
import { formatDate } from './AdminUtils.js'
import AdminPagination from './AdminPagination.jsx'
import EmptyTableRow from './EmptyTableRow.jsx'

function UsersTab({
  users,
  userSearch,
  setUserSearch,
  userPlanFilter,
  setUserPlanFilter,
  loadUsers,
  handleUpdateUser,
  handleDeleteUser,
  socialAccounts,
  loadSocialAccounts,
  handleDeleteSocialAccount
}) {
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [socialFilter, setSocialFilter] = useState({ user_id: '', provider: '' })

  const startEdit = (user) => {
    setEditingUser(user.id)
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      subscription_type: user.subscription_type || 'free'
    })
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setEditForm({})
  }

  const saveEdit = async (userId) => {
    await handleUpdateUser(userId, editForm)
    setEditingUser(null)
    setEditForm({})
  }

  return (
    <div className="admin__users">
      <div className="admin__toolbar">
        <input
          type="text"
          placeholder="이메일/휴대폰 검색"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
        <select
          value={userPlanFilter}
          onChange={(e) => setUserPlanFilter(e.target.value)}
        >
          <option value="">전체 플랜</option>
          <option value="free">무료</option>
          <option value="basic">베이직</option>
          <option value="premium">프리미엄</option>
          <option value="vip">VIP</option>
        </select>
        <button onClick={() => loadUsers(1)}>검색</button>
      </div>
      <table className="admin__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>식별자</th>
            <th>이름</th>
            <th>이메일</th>
            <th>휴대폰</th>
            <th>활성</th>
            <th>관리자</th>
            <th>구독</th>
            <th>최근접속</th>
            <th>가입일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {users.users.length === 0 ? (
            <EmptyTableRow colSpan={11} message="회원이 없습니다." />
          ) : (
            users.users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.identifier}</td>
                <td>
                  {editingUser === user.id ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      style={{ width: '80px' }}
                    />
                  ) : (
                    user.name || '-'
                  )}
                </td>
                <td>
                  {editingUser === user.id ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      style={{ width: '120px' }}
                    />
                  ) : (
                    user.email || '-'
                  )}
                </td>
                <td>
                  {editingUser === user.id ? (
                    <input
                      type="text"
                      value={editForm.phone_number}
                      onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                      style={{ width: '100px' }}
                    />
                  ) : (
                    user.phone_number || '-'
                  )}
                </td>
                <td>
                  <button
                    className={`admin__toggle ${user.is_active ? 'admin__toggle--on' : ''}`}
                    onClick={() => handleUpdateUser(user.id, { is_active: !user.is_active })}
                  >
                    {user.is_active ? 'Y' : 'N'}
                  </button>
                </td>
                <td>
                  <button
                    className={`admin__toggle ${user.is_admin ? 'admin__toggle--on' : ''}`}
                    onClick={() => handleUpdateUser(user.id, { is_admin: !user.is_admin })}
                  >
                    {user.is_admin ? 'Y' : 'N'}
                  </button>
                </td>
                <td>
                  {editingUser === user.id ? (
                    <select
                      value={editForm.subscription_type}
                      onChange={(e) => setEditForm({ ...editForm, subscription_type: e.target.value })}
                    >
                      <option value="free">free</option>
                      <option value="basic">basic</option>
                      <option value="premium">premium</option>
                      <option value="vip">vip</option>
                    </select>
                  ) : (
                    user.subscription_type || 'free'
                  )}
                </td>
                <td>{formatDate(user.last_login_at)}</td>
                <td>{formatDate(user.created_at)}</td>
                <td>
                  {editingUser === user.id ? (
                    <>
                      <button className="admin__btn admin__btn--primary" onClick={() => saveEdit(user.id)}>
                        저장
                      </button>
                      <button className="admin__btn" onClick={cancelEdit} style={{ marginLeft: '4px' }}>
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="admin__btn" onClick={() => startEdit(user)}>
                        편집
                      </button>
                      <button
                        className="admin__btn admin__btn--danger"
                        onClick={() => handleDeleteUser(user.id)}
                        style={{ marginLeft: '4px' }}
                      >
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
        page={users.page}
        total={users.total}
        pageSize={users.page_size}
        onPageChange={loadUsers}
      />

      {/* 소셜 계정 관리 섹션 */}
      <div className="admin__section" style={{ marginTop: '40px' }}>
        <h3>소셜 계정 관리</h3>
        <div className="admin__toolbar">
          <input
            type="number"
            placeholder="사용자 ID"
            value={socialFilter.user_id}
            onChange={(e) => setSocialFilter({ ...socialFilter, user_id: e.target.value })}
            style={{ width: '100px' }}
          />
          <select
            value={socialFilter.provider}
            onChange={(e) => setSocialFilter({ ...socialFilter, provider: e.target.value })}
          >
            <option value="">전체</option>
            <option value="NAVER">네이버</option>
            <option value="KAKAO">카카오</option>
          </select>
          <button
            onClick={() => loadSocialAccounts(1, socialFilter)}
          >
            검색
          </button>
        </div>

        {socialAccounts && (
          <>
            <table className="admin__table" style={{ marginTop: '15px' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>사용자 ID</th>
                  <th>사용자 식별자</th>
                  <th>제공자</th>
                  <th>제공자 ID</th>
                  <th>연동일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {socialAccounts.accounts.length === 0 ? (
                  <EmptyTableRow colSpan={7} message="소셜 계정이 없습니다." />
                ) : (
                  socialAccounts.accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.id}</td>
                      <td>{account.user_id}</td>
                      <td>{account.user_identifier || '-'}</td>
                      <td>
                        <span className={`admin__badge admin__badge--${account.provider.toLowerCase()}`}>
                          {account.provider}
                        </span>
                      </td>
                      <td>{account.provider_user_id}</td>
                      <td>{formatDate(account.linked_at)}</td>
                      <td>
                        <button
                          className="admin__btn admin__btn--danger admin__btn--small"
                          onClick={() => handleDeleteSocialAccount(account.id)}
                        >
                          연동 해제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <AdminPagination
              page={socialAccounts.page}
              total={socialAccounts.total}
              pageSize={socialAccounts.page_size}
              onPageChange={(p) => loadSocialAccounts(p, socialFilter)}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default UsersTab
