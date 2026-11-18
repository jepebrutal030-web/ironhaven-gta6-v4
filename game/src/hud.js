// HUD: health, money, wanted stars, objective + distance, speedometer,
// ammo, crosshair, hitmarker, damage vignette — plus a live 2D minimap.
// The wanted level is a NUMBER (game.wanted.wanted); render that many stars.
import { CITY_HALF, ROADS } from './config.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.healthFill = document.getElementById('health-fill');
    this.moneyEl = document.getElementById('money');
    this.starsEl = document.getElementById('stars');
    this.objEl = document.getElementById('objective');
    this.objDistEl = document.getElementById('obj-dist');
    this.speedEl = document.getElementById('speed');
    this.ammoEl = document.getElementById('ammo');
    this.crossEl = document.getElementById('crosshair');
    this.hitEl = document.getElementById('hitmarker');
    this.vigEl = document.getElementById('vignette');
    this.flashEl = document.getElementById('flash');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.flashT = 0;
    this.hitT = 0;
    this.objective = '';
    this.target = null;
  }

  setObjective(text, target) {
    this.objective = text;
    this.target = target;
    if (this.objEl) this.objEl.textContent = text;
  }
  flash(text) {
    if (!this.flashEl) return;
    this.flashEl.textContent = text;
    this.flashEl.style.opacity = '1';
    this.flashT = 2.5;
  }
  hitmark() { this.hitT = 0.25; if (this.hitEl) this.hitEl.style.opacity = '1'; }
  damage() { if (this.vigEl) { this.vigEl.style.opacity = '0.85'; setTimeout(() => { this.vigEl.style.opacity = '0'; }, 180); } }
  showEnd() {
    const s = document.getElementById('screen-end');
    if (s) s.classList.add('visible');
  }

  update(dt, g) {
    const p = g.player;
    if (this.healthFill) this.healthFill.style.width = Math.max(0, p.health) + '%';
    if (this.moneyEl) this.moneyEl.textContent = '$' + g.money.toLocaleString('en-US');
    // stars: wanted is a NUMBER — render exactly that many filled stars
    if (this.starsEl) {
      const n = g.wanted.wanted;
      let s = '';
      for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
      this.starsEl.textContent = s;
      this.starsEl.style.color = n > 0 ? '#ffd21a' : '#8a8a8a';
    }
    if (this.objDistEl && this.target) {
      const d = Math.hypot(p.pos.x - this.target.x, p.pos.z - this.target.z);
      this.objDistEl.textContent = this.target.label + ' — ' + Math.round(d) + 'm';
    } else if (this.objDistEl) this.objDistEl.textContent = '';
    if (this.speedEl) {
      this.speedEl.textContent = g.driving ? Math.round(g.speedMph) + ' mph' : '';
    }
    if (this.ammoEl) this.ammoEl.textContent = p.reloading > 0 ? 'RELOADING' : ('AMMO ' + p.ammo + ' / ' + 12);
    if (this.crossEl) this.crossEl.style.display = (!g.driving && g.mode === 'playing') ? 'block' : 'none';
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0 && this.hitEl) this.hitEl.style.opacity = '0'; }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0 && this.flashEl) this.flashEl.style.opacity = '0'; }
    this.drawMinimap(g);
  }

  drawMinimap(g) {
    if (!this.mapCtx) return;
    const ctx = this.mapCtx, S = this.map.width, half = CITY_HALF;
    const toPx = (v) => ((v + half) / (half * 2)) * S;
    ctx.fillStyle = 'rgba(10, 18, 12, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // sea
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(toPx(204), 0, S - toPx(204), S);
    // roads
    ctx.strokeStyle = '#5a5a5a'; ctx.lineWidth = 3;
    for (const r of ROADS) {
      ctx.beginPath(); ctx.moveTo(toPx(r), 0); ctx.lineTo(toPx(r), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toPx(r)); ctx.lineTo(S, toPx(r)); ctx.stroke();
    }
    // mission target
    if (this.target) {
      ctx.fillStyle = '#ffd21a';
      ctx.beginPath(); ctx.arc(toPx(this.target.x), toPx(this.target.z), 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd21a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(toPx(this.target.x), toPx(this.target.z), 8, 0, Math.PI * 2); ctx.stroke();
    }
    // parked + traffic (grey dots)
    ctx.fillStyle = '#b8b8b8';
    for (const c of g.parked || []) ctx.fillRect(toPx(c.group.position.x) - 1, toPx(c.group.position.z) - 1, 2, 2);
    // police (red/blue)
    for (const c of g.wanted.policeCars) {
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(toPx(c.group.position.x), toPx(c.group.position.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const c of g.wanted.footCops) {
      ctx.fillStyle = '#ff8040';
      ctx.beginPath(); ctx.arc(toPx(c.group.position.x), toPx(c.group.position.z), 2, 0, Math.PI * 2); ctx.fill();
    }
    // player (white triangle, rotated by yaw)
    const p = g.player.pos;
    ctx.save();
    ctx.translate(toPx(p.x), toPx(p.z));
    ctx.rotate(-g.player.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // north + border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, S - 2, S - 2);
  }
}
