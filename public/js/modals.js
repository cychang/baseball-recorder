import { buildTeamOptions, buildTeamOptionsMulti, buildTournamentOptions } from './data-helpers.js';
import { ui } from './dom.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export function openCreateModal(type) {
  state.currentEditType = type;
  state.currentEditId = null;
  ui.modalTitle.textContent = '新增 ' + ({ team: '球隊', player: '球員', tournament: '盃賽', game: '比賽' }[type]);

  const today = new Date().toISOString().slice(0, 10);
  const forms = {
    team: `
      <input name="name" placeholder="球隊名稱" required />
      <button type="submit">新增球隊</button>
    `,
    player: `
      <input name="name" placeholder="球員姓名" required />
      <div class="row">
        <select name="teamIds" multiple required>
          ${buildTeamOptionsMulti([])}
        </select>
        <input name="jersey" placeholder="背號" />
      </div>
      <div class="status-box" style="margin-top: 0;">成績會由紀錄自動累加，不在球員資料手動輸入。</div>
      <button type="submit">新增球員</button>
    `,
    tournament: `
      <input name="name" placeholder="盃賽名稱" required />
      <input name="season" placeholder="賽季" required />
      <button type="submit">新增盃賽</button>
    `,
    game: `
      <div class="row">
        <select name="tournamentId" required>
          ${buildTournamentOptions('')}
        </select>
        <input name="date" type="date" value="${today}" required />
      </div>
      <input name="time" type="time" />
      <div class="row">
        <select name="homeTeamId" required>
          ${buildTeamOptions('').replace('選擇球隊', '選擇主隊')}
        </select>
        <select name="awayTeamId" required>
          ${buildTeamOptions('').replace('選擇球隊', '選擇客隊')}
        </select>
      </div>
      <div class="row"><input name="score" placeholder="比分可空白，例：7-4" /><input name="venue" placeholder="場地" required /></div>
      <select name="status" required>
        <option value="not_started">未開始</option>
        <option value="live">進行中</option>
        <option value="completed">已結束</option>
        <option value="cancelled">取消</option>
      </select>
      <button type="submit">新增比賽</button>
    `,
  };

  ui.editForm.innerHTML = forms[type] || '';
  ui.editModal.classList.add('visible');
  ui.editModal.setAttribute('aria-hidden', 'false');
}

export function openEditModal(type, item) {
  state.currentEditType = type;
  state.currentEditId = item?.id || null;
  ui.modalTitle.textContent = '編輯 ' + ({ team: '球隊', player: '球員', tournament: '盃賽', game: '比賽' }[type]);

  const forms = {
    team: `
      <input type="hidden" name="id" value="${item.id}" />
      <input name="name" value="${escapeHtml(item.name)}" placeholder="球隊名稱" required />
      <button type="submit">更新球隊</button>
    `,
    player: `
      <input type="hidden" name="id" value="${item.id}" />
      <input name="name" value="${escapeHtml(item.name)}" placeholder="球員姓名" required />
      <div class="row">
        <select name="teamIds" multiple required>
          ${buildTeamOptionsMulti(item.teamIds || [item.teamId])}
        </select>
        <input name="jersey" value="${escapeHtml(item.jersey)}" placeholder="背號" />
      </div>
      <div class="status-box" style="margin-top: 0;">目前累加：PA ${item.plateAppearances || 0} / AB ${item.atBats || 0} / H ${item.hits || 0} / AVG ${Number(item.battingAverage || 0).toFixed(3)} / OPS ${Number(item.ops || 0).toFixed(3)} / HR ${item.hr || 0} / RBI ${item.rbi || 0}</div>
      <button type="submit">更新球員</button>
    `,
    tournament: `
      <input type="hidden" name="id" value="${item.id}" />
      <input name="name" value="${escapeHtml(item.name)}" placeholder="盃賽名稱" required />
      <input name="season" value="${escapeHtml(item.season)}" placeholder="賽季" required />
      <button type="submit">更新盃賽</button>
    `,
    game: `
      <input type="hidden" name="id" value="${item.id}" />
      <div class="row">
        <select name="tournamentId" required>
          ${buildTournamentOptions(item.tournamentId)}
        </select>
        <input name="date" type="date" value="${escapeHtml(item.date || '')}" required />
      </div>
      <input name="time" type="time" value="${escapeHtml(item.time || '')}" />
      <div class="row">
        <select name="homeTeamId" required>
          ${buildTeamOptions(item.homeTeamId).replace('選擇球隊', '選擇主隊')}
        </select>
        <select name="awayTeamId" required>
          ${buildTeamOptions(item.awayTeamId).replace('選擇球隊', '選擇客隊')}
        </select>
      </div>
      <div class="row"><input name="score" value="${escapeHtml(item.score)}" placeholder="比分可空白，例：7-4" /><input name="venue" value="${escapeHtml(item.venue)}" placeholder="場地" required /></div>
      <div class="row">
        <select name="status" required>
          <option value="not_started" ${(item.status || 'not_started') === 'not_started' ? 'selected' : ''}>未開始</option>
          <option value="live" ${item.status === 'live' ? 'selected' : ''}>進行中</option>
          <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>已結束</option>
          <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>取消</option>
        </select>
      </div>
      <button type="submit">更新比賽</button>
    `,
  };

  ui.editForm.innerHTML = forms[type] || '';
  ui.editModal.classList.add('visible');
  ui.editModal.setAttribute('aria-hidden', 'false');
}

export function closeEditModal() {
  ui.editModal.classList.remove('visible');
  ui.editModal.setAttribute('aria-hidden', 'true');
  state.currentEditType = null;
  state.currentEditId = null;
}
