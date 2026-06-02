// ==========================================
// MOTEUR UNIVERSEL CTO 
// ==========================================
function toggleFormCto() {
  var type = document.getElementById('cto_type').value;
  if (type === 'dividende') {
    document.getElementById('cto-row-name-libre').style.display = 'none'; document.getElementById('cto-row-name-select').style.display = 'flex';
    document.getElementById('cto-form-quantite').style.display = 'none'; document.getElementById('cto-form-dividende').style.display = 'block';
  } else {
    document.getElementById('cto-row-name-libre').style.display = 'flex'; document.getElementById('cto-row-name-select').style.display = 'none';
    document.getElementById('cto-row-name-custom-div').style.display = 'none'; document.getElementById('cto-form-quantite').style.display = 'block';
    document.getElementById('cto-form-dividende').style.display = 'none'; document.getElementById('cto-row-frais').style.display = (type === 'achat') ? 'flex' : 'none';
  }
}

function handleCtoNameSelect() { var s = document.getElementById('cto_name_select'); document.getElementById('cto-row-name-custom-div').style.display = (s.value === '__NEW__') ? 'flex' : 'none'; }

function updateCtoDividendsDropdown() {
  var pos = calculerPositionsCTO(), s = document.getElementById('cto_name_select'); if(!s) return; s.innerHTML = '';
  Object.keys(pos).forEach(function(n) { if(pos[n].parts > 0) { var o = document.createElement('option'); o.value = n; o.textContent = n + ' (Détenu)'; s.appendChild(o); } });
  var oN = document.createElement('option'); oN.value = '__NEW__'; oN.textContent = '➕ Autre nom libre...'; s.appendChild(oN); handleCtoNameSelect();
}

function calculerPositionsCTO() {
  var pos = {}; appData.cto.historique.slice().reverse().forEach(function(m) {
    var n = m.actif; if(!pos[n]) pos[n] = { parts: 0, totalCost: 0, cumulativeDividends: 0 };
    if (m.type === 'achat') { pos[n].parts += parseFloat(m.nb); pos[n].totalCost += parseFloat(m.total); }
    else if (m.type === 'vente') { var p = pos[n].parts > 0 ? (pos[n].totalCost / pos[n].parts) : 0; pos[n].parts -= parseFloat(m.nb); pos[n].totalCost -= (p * parseFloat(m.nb)); }
    else if (m.type === 'dividende') { pos[n].cumulativeDividends += parseFloat(m.total); }
  });
  return pos;
}

function ajouterMouvementCTO() {
  var type = document.getElementById('cto_type').value, name = "";
  if (type === 'dividende') { var sV = document.getElementById('cto_name_select').value; name = (sV === '__NEW__') ? document.getElementById('cto-row-name-custom-div').value.trim() : sV; }
  else { name = document.getElementById('cto_name').value.trim(); }
  if(!name) return; var baseObj = { id: generateId(), type: type, actif: name, date: formatDateToFR(document.getElementById('cto_date').value) };

  if(type === 'achat' || type === 'vente') {
    var q = parseFloat(document.getElementById('cto_q').value)||0, p = parseFloat(document.getElementById('cto_p').value)||0, f = type==='achat'?(parseFloat(document.getElementById('cto_frais').value)||0):0;
    if(q <= 0 || p <= 0) return; baseObj.nb = q; baseObj.prix = p; baseObj.frais = f; baseObj.total = (type === 'achat' ? (q * p) + f : (q * p)).toFixed(2);
    appData.cto.historique.unshift(baseObj); if(appData.cto.cours[name] === undefined || type === 'achat') appData.cto.cours[name] = p;
  } else {
    var m = parseFloat(document.getElementById('cto_div_montant').value)||0; if(m <= 0) return;
    baseObj.total = m.toFixed(2); baseObj.frais = 0; appData.cto.historique.unshift(baseObj);
  }
  saveData(appData); alert('✅ Enregistré.'); document.getElementById('cto_name').value = ''; document.getElementById('cto_name_custom_div').value = '';
  document.getElementById('cto_q').value = ''; document.getElementById('cto_p').value = ''; document.getElementById('cto_div_montant').value = '';
  initDatesFormulaires(); showSubTab('cto', 'portefeuille');
}

function supprimerMouvementCTO(id) {
  if(confirm("Supprimer ce mouvement CTO ?")) { appData.cto.historique = appData.cto.historique.filter(function(m){return m.id!==id;}); saveData(appData); showSubTab('cto', 'portefeuille'); }
}

function updateCtoCours(name, value) { appData.cto.cours[name] = parseFloat(value) || 0; saveData(appData); renderCTOUniverseOnly(); }
function saveCtoSettings() { appData.cto.settings.tax_rate = parseFloat(document.getElementById('cto_tax_rate').value) || 30.0; saveData(appData); alert('Paramètres CTO sauvés.'); }

function renderCTOInputsCours() {
  var pos = calculerPositionsCTO(), h = '';
  Object.keys(pos).filter(function(n){ return pos[n].parts > 0; }).forEach(function(nom) {
    h += '<div class="row"><label><span class="tag tag-cto">'+nom+'</span></label><input type="number" inputmode="decimal" pattern="[0-9]*" value="'+(appData.cto.cours[nom]||0)+'" oninput="updateCtoCours(\''+nom+'\', this.value)"></div>';
  });
  document.getElementById('cto-cours-inputs-container').innerHTML = h || '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:10px;">Aucun actif en portefeuille.</div>';
}

function renderCTOUniverse() { renderCTOInputsCours(); renderCTOUniverseOnly(); }

function renderCTOUniverseOnly() {
  var pos = calculerPositionsCTO(), tbody = document.getElementById('cto-positions-body'); if(!tbody) return; tbody.innerHTML = '';
  var gVal = 0, gCost = 0, gDivs = 0, totalFees = 0;
  
  appData.cto.historique.slice().reverse().forEach(function(m) { totalFees += parseFloat(m.frais || 0); if(m.type === 'dividende') gDivs += parseFloat(m.total); });

  Object.keys(pos).forEach(function(nom) {
    var p = pos[nom]; if(p.parts <= 0) return;
    var valuation = p.parts * (appData.cto.cours[nom] || 0), pru = p.totalCost / p.parts, pvL = valuation - p.totalCost, pvP = p.totalCost > 0 ? (pvL / p.totalCost * 100) : 0;
    gVal += valuation; gCost += p.totalCost;

    var tr = document.createElement('tr');
    tr.innerHTML = '<td><span class="tag tag-cto">'+nom+'</span></td><td><b>'+p.parts+'</b></td><td>'+pru.toFixed(2)+' €</td><td><b style="color:var(--usa)">'+(appData.cto.cours[nom]||0).toFixed(2)+' €</b></td><td><b>'+valuation.toFixed(2)+' €</b></td><td style="color:'+(pvL>=0?'var(--eu)':'var(--red)')+'; font-weight:bold;">'+(pvL>=0?'+':'')+pvL.toFixed(2)+' €<br><small>('+pvP.toFixed(1)+'%)</small></td>';
    tbody.appendChild(tr);
  });

  if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">Aucune position ouverte.</td></tr>';
  var gGain = (gVal + gDivs) - gCost, gPct = gCost > 0 ? (gGain / gCost) * 100 : 0;
  var flatTax = gGain > 0 ? (gGain * ((appData.cto.settings.tax_rate || 30.0) / 100)) : 0;

  document.getElementById('cto-dashboard-container').innerHTML = '<div class="card"><h2>Performance Portefeuille CTO</h2><div class="sim-row" style="padding:4px 0 12px 0;"><span>Valeur Brute :</span> <b style="font-size:22px; color:white;">'+gVal.toFixed(2)+' €</b></div><div class="fees-container-badge" style="margin-bottom:14px;">Frais de courtage : <b>'+totalFees.toFixed(2)+' €</b></div><div class="stat-grid"><div class="stat-box" style="border-top:3px solid var(--eu);"><div class="stat-lbl">Gain Réel Absolu</div><div class="stat-val" style="color:'+(gGain>=0?'var(--eu)':'var(--red)')+';">'+(gGain>=0?'+':'')+gGain.toFixed(2)+' €<br><small>('+gPct.toFixed(1)+'%)</small></div></div><div class="stat-box" style="border-top:3px solid var(--usa);"><div class="stat-lbl">Plus-Value Latente</div><div class="stat-val" style="color:'+((gVal-gCost)>=0?'var(--eu)':'var(--red)')+';">'+((gVal-gCost)>=0?'+':'')+(gVal-gCost).toFixed(2)+' €</div></div></div></div><div class="card" style="border-left:4px solid var(--red); background:rgba(244,63,94,0.03);"><h2>⚖️ Estimation Fiscale CTO ('+(appData.cto.settings.tax_rate||30.0)+'%)</h2><div class="sim-row"><span>Taxe estimée :</span> <b style="color:var(--red);">- '+flatTax.toFixed(2)+' €</b></div><div class="sim-row" style="border-top:1px dashed rgba(255,255,255,0.1); margin-top:6px; padding-top:6px;"><span>💰 <b>Valeur après flat tax :</b></span> <b style="color:var(--eu);">'+(gVal - flatTax).toFixed(2)+' €</b></div></div>';
}

function renderHistCTO() {
  var h = ''; appData.cto.historique.forEach(function(a){
    var det = '';
    if(a.type === 'dividende') det = '<span class="tag tag-div">DIV</span> <b>'+a.actif+'</b> <span style="float:right; color:var(--div);">+ '+parseFloat(a.total).toFixed(2)+' €</span>';
    else if(a.type === 'achat') det = '<span class="tag tag-usa">ACHAT</span> <b>'+a.actif+'</b> • '+a.nb+' part(s) <span style="float:right;">- '+parseFloat(a.total).toFixed(2)+' €</span>';
    else det = '<span class="tag tag-red">VENTE</span> <b>'+a.actif+'</b> • '+a.nb+' part(s) <span style="float:right; color:var(--eu);">+ '+parseFloat(a.total).toFixed(2)+' €</span>';
    h += '<div class="hist-item" style="border-left:3px solid '+(a.type==='dividende'?'var(--div)':(a.type==='achat'?'var(--usa)':'var(--red)'))+';"><div class="hist-content">'+det+'<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Le '+a.date+'</div></div><button class="btn-delete-item" onclick="supprimerMouvementCTO(\''+a.id+'\')">🗑️</button></div>';
  });
  document.getElementById('cto-hist-container').innerHTML = h ? '<div class="card" style="margin-top:14px;"><h2>Livre des Écritures CTO</h2>'+h+'</div>' : '<div class="card" style="margin-top:14px; text-align:center; color:var(--text-muted);">Aucune transaction.</div>';
}

