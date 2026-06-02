// ==========================================
// 1. GESTION DU STOCKAGE & DONNÉES
// ==========================================
function loadData() {
  var local = localStorage.getItem("patrimoine_multi_v6");
  if (local) {
    try { 
      var parsed = JSON.parse(local);
      if(!parsed.pea) parsed.pea = {};
      if(!parsed.cto) parsed.cto = { historique: [], cours: {}, settings: { tax_rate: 30.0 } };
      if(!parsed.cto.settings) parsed.cto.settings = { tax_rate: 30.0 };
      if(!parsed.pea.historique) parsed.pea.historique = [];
      if(!parsed.global_history) parsed.global_history = [];
      return parsed;
    } catch(e) {}
  }
  return {
    global_history: [],
    pea: {
      cibles: { usa: 60, eu: 30, em: 10 },
      prix: { usa: 56.34, eu: 20.47, em: 7.75 },
      historique: [],
      settings: { budget: '', alerte_seuil: 5, taux_fisc: 17.2, frais_courtage: 1.00 }
    },
    cto: { historique: [], cours: {}, settings: { tax_rate: 30.0 } }
  };
}

function saveData(d) { localStorage.setItem("patrimoine_multi_v6", JSON.stringify(d)); }

var appData = loadData();
var universActuel = 'home';

function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function patchMissingIds() {
  var changed = false;
  if(appData.pea && appData.pea.historique) {
    appData.pea.historique.forEach(function(m) { if(!m.id) { m.id = generateId(); changed = true; } });
  }
  if(appData.cto && appData.cto.historique) {
    appData.cto.historique.forEach(function(m) { if(!m.id) { m.id = generateId(); changed = true; } });
  }
  if(changed) saveData(appData);
}
patchMissingIds();

// ==========================================
// 2. OUTILS & NAVIGATION
// ==========================================
function formatDateToFR(dateString) {
  if(!dateString) return new Date().toLocaleDateString('fr-FR');
  var parts = dateString.split('-');
  if(parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
  return dateString;
}

function initDatesFormulaires() {
  var aujourdhui = new Date().toISOString().split('T')[0];
  if(document.getElementById('man_date')) document.getElementById('man_date').value = aujourdhui;
  if(document.getElementById('cto_date')) document.getElementById('cto_date').value = aujourdhui;
}

function switchUnivers(u) {
  universActuel = u;
  document.getElementById('btn-main-home').classList.toggle('active', u === 'home');
  document.getElementById('btn-main-pea').classList.toggle('active', u === 'pea');
  document.getElementById('btn-main-cto').classList.toggle('active', u === 'cto');
  
  document.getElementById('univers-home').style.display = (u === 'home') ? 'block' : 'none';
  document.getElementById('univers-pea').style.display = (u === 'pea') ? 'block' : 'none';
  document.getElementById('univers-cto').style.display = (u === 'cto') ? 'block' : 'none';
  
  if(u === 'home') {
    calculerEtAfficherAccueilGlobal();
  } else if(u === 'pea') {
    showSubTab('pea', 'portefeuille');
  } else {
    showSubTab('cto', 'portefeuille');
  }
}

function showSubTab(univ, section) {
  var tabs = univ === 'pea' ? ['portefeuille','analyse','historique','config'] : ['portefeuille','historique','config'];
  tabs.forEach(function(t) {
    var el = document.getElementById(univ + '-' + t);
    if(el) el.classList.toggle('active', t === section);
    var btn = document.getElementById('subtab-' + univ + '-' + t.substring(0,1));
    if(btn) btn.classList.toggle('active', t === section);
  });

  if(univ === 'pea') {
    if(section === 'portefeuille') { recalculerQuantitesPEA(); calculerOrdreOptimal(); }
    if(section === 'analyse') { renderStatsPEA(); calcPEA(); }
    if(section === 'historique') { renderHistPEA(); initDatesFormulaires(); }
    if(section === 'config') updateCibleTotal();
  } else {
    if(section === 'portefeuille') { renderCTOInputsCours(); renderCTOUniverse(); }
    if(section === 'historique') { renderHistCTO(); updateCtoDividendsDropdown(); toggleFormCto(); initDatesFormulaires(); }
    if(section === 'config') { document.getElementById('cto_tax_rate').value = appData.cto.settings.tax_rate || 30.0; }
  }
}

// ==========================================
// 3. CALCULS CONSOLIDÉS & ACCUEIL
// ==========================================
function obtenirDonneesConsolidees() {
  var qPea = { usa: 0, eu: 0, em: 0 };
  var peaInvestiReel = 0; var peaDividendes = 0; var peaFraisCumules = 0;
  
  appData.pea.historique.forEach(function(m){
    peaFraisCumules += parseFloat(m.frais || 0);
    if (m.type === 'achat' || !m.type) { qPea[m.tag] += parseFloat(m.nb || 0); peaInvestiReel += parseFloat(m.total || 0); }
    else if (m.type === 'vente') { qPea[m.tag] -= parseFloat(m.nb || 0); peaInvestiReel -= parseFloat(m.total || 0); }
    else if (m.type === 'dividende') { peaDividendes += parseFloat(m.total || 0); }
  });
  var peaValeurBrute = (qPea.usa * (appData.pea.prix.usa || 0)) + (qPea.eu * (appData.pea.prix.eu || 0)) + (qPea.em * (appData.pea.prix.em || 0));
  var peaGainGlobal = (peaValeurBrute + peaDividendes) - peaInvestiReel;
  var peaTaxeTheorique = peaGainGlobal > 0 ? (peaGainGlobal * ((appData.pea.settings.taux_fisc || 17.2) / 100)) : 0;
  var peaValeurNette = peaValeurBrute - peaTaxeTheorique;

  var posCto = {};
  var ctoInvestiReel = 0; var ctoDividendes = 0; var ctoFraisCumules = 0;
  
  appData.cto.historique.slice().reverse().forEach(function(m) {
    ctoFraisCumules += parseFloat(m.frais || 0);
    var name = m.actif;
    if(!posCto[name]) posCto[name] = { parts: 0, totalCost: 0 };
    if (m.type === 'achat') {
      posCto[name].parts += parseFloat(m.nb); posCto[name].totalCost += parseFloat(m.total);
    } else if (m.type === 'vente') {
      var currentPru = posCto[name].parts > 0 ? (posCto[name].totalCost / posCto[name].parts) : 0;
      posCto[name].parts -= parseFloat(m.nb); posCto[name].totalCost -= (currentPru * parseFloat(m.nb));
    } else if (m.type === 'dividende') { ctoDividendes += parseFloat(m.total); }
  });
  
  var ctoValeurBrute = 0;
  Object.keys(posCto).forEach(function(nom) {
    ctoValeurBrute += (posCto[nom].parts * (appData.cto.cours[nom] || 0));
    ctoInvestiReel += posCto[nom].totalCost;
  });
  var ctoGainGlobal = (ctoValeurBrute + ctoDividendes) - ctoInvestiReel;
  var ctoTaxeTheorique = ctoGainGlobal > 0 ? (ctoGainGlobal * ((appData.cto.settings.tax_rate || 30.0) / 100)) : 0;
  var ctoValeurNette = ctoValeurBrute - ctoTaxeTheorique;

  return {
    peaBrut: peaValeurBrute, peaNet: peaValeurNette, peaInvesti: peaInvestiReel, peaGain: peaGainGlobal, peaFrais: peaFraisCumules, peaDiv: peaDividendes,
    ctoBrut: ctoValeurBrute, ctoNet: ctoValeurNette, ctoInvesti: ctoInvestiReel, ctoGain: ctoGainGlobal, ctoFrais: ctoFraisCumules, ctoDiv: ctoDividendes
  };
}

function calculerEtAfficherAccueilGlobal() {
  var c = obtenirDonneesConsolidees();
  var patrimoineNetGlobal = c.peaNet + c.ctoNet;
  var totalBrutGlobal = c.peaBrut + c.ctoBrut;

  document.getElementById('global-total-net').textContent = patrimoineNetGlobal.toFixed(2) + ' €';
  document.getElementById('global-dividendes-total').textContent = (c.peaDiv + c.ctoDiv).toFixed(2) + ' €';
  document.getElementById('global-fees-total').textContent = (c.peaFrais + c.ctoFrais).toFixed(2) + ' €';

  document.getElementById('widget-pea-val').textContent = c.peaBrut.toFixed(2) + ' €';
  document.getElementById('widget-pea-investi').textContent = Math.max(0, c.peaInvesti).toFixed(2) + ' €';
  document.getElementById('widget-pea-perf').textContent = (c.peaGain >= 0 ? '+' : '') + c.peaGain.toFixed(2) + ' €';
  document.getElementById('widget-pea-perf').className = 'widget-perf ' + (c.peaGain >= 0 ? 'perf-up' : 'perf-down');

  document.getElementById('widget-cto-val').textContent = c.ctoBrut.toFixed(2) + ' €';
  document.getElementById('widget-cto-investi').textContent = Math.max(0, c.ctoInvesti).toFixed(2) + ' €';
  document.getElementById('widget-cto-perf').textContent = (c.ctoGain >= 0 ? '+' : '') + c.ctoGain.toFixed(2) + ' €';
  document.getElementById('widget-cto-perf').className = 'widget-perf ' + (c.ctoGain >= 0 ? 'perf-up' : 'perf-down');

  var pctPea = totalBrutGlobal > 0 ? (c.peaBrut / totalBrutGlobal * 100) : 50;
  var pctCto = totalBrutGlobal > 0 ? (c.ctoBrut / totalBrutGlobal * 100) : 50;
  
  document.getElementById('macro-bar-pea').style.width = pctPea + '%';
  document.getElementById('macro-bar-cto').style.width = pctCto + '%';
  document.getElementById('macro-txt-pea').textContent = (totalBrutGlobal > 0 ? pctPea.toFixed(1) : '0') + '%';
  document.getElementById('macro-txt-cto').textContent = (totalBrutGlobal > 0 ? pctCto.toFixed(1) : '0') + '%';

  renderGlobalTrendChartCurve();
}

function figerSoldeGlobal() {
  var c = obtenirDonneesConsolidees();
  appData.global_history.push({
    date: new Date().toLocaleDateString('fr-FR').substring(0,5),
    investi: parseFloat((c.peaInvesti + c.ctoInvesti).toFixed(2)),
    brut: parseFloat((c.peaBrut + c.ctoBrut).toFixed(2))
  });
  saveData(appData); renderGlobalTrendChartCurve(); alert('📸 Point sauvegardé !');
}

function renderGlobalTrendChartCurve() {
  var container = document.getElementById('chart-svg-wrapper-target');
  var pts = appData.global_history || [];
  if(pts.length < 1) { 
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px;border:1px dashed rgba(255,255,255,0.05);border-radius:12px;">Aucun point enregistré. Cliquez ci-dessous pour démarrer.</div>'; 
    return; 
  }
  var renderPts = pts.slice(); if(renderPts.length === 1) renderPts.push(renderPts[0]);
  var maxVal = Math.max.apply(Math, renderPts.map(function(o){ return Math.max(o.investi, o.brut); })) * 1.12 || 100;

  var width = 500, height = 130, pLR = 20, pTB = 15, effW = width - (pLR * 2), effH = height - (pTB * 2), stepX = effW / (renderPts.length - 1);
  var pathInvestiArr = [], pathBrutArr = [], zones = '';

  renderPts.forEach(function(p, i) {
    var x = pLR + (i * stepX), yInv = height - pTB - ((p.investi / maxVal) * effH), yBrt = height - pTB - ((p.brut / maxVal) * effH);
    pathInvestiArr.push(x + ',' + yInv); pathBrutArr.push(x + ',' + yBrt);
    var diff = p.brut - p.investi;
    zones += '<div class="chart-node-col"><div class="chart-tooltip-v2">📅 <b>' + p.date + '</b><br>⚪ Investi : ' + p.investi.toFixed(2) + ' €<br>🟢 Valeur : ' + p.brut.toFixed(2) + ' €<br>Performance : <b style="color:' + (diff >= 0 ? 'var(--eu)' : 'var(--red)') + ';">' + (diff>=0?'+':'') + diff.toFixed(2) + ' €</b></div></div>';
  });

  container.innerHTML = '<div class="trend-chart-wrapper"><svg class="trend-svg" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none"><line x1="0" y1="'+(height/2)+'" x2="'+width+'" y2="'+(height/2)+'" stroke="rgba(255,255,255,0.03)" /><defs><linearGradient id="cG"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs><path d="M '+pathInvestiArr.join(" L ")+'" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="4,4" /><path d="M '+pathBrutArr.join(" L ")+'" fill="none" stroke="url(#cG)" stroke-width="3" /></svg><div class="chart-interactive-zone">'+zones+'</div></div><div class="chart-timeline-labels"><span>Début ('+pts[0].date+')</span><span>Fin ('+pts[pts.length-1].date+')</span></div>';
}

// ==========================================
// 4. EXPORT & ACTIONS GLOBALES
// ==========================================
function exportJSON() {
  var blob = new Blob([JSON.stringify(appData, null, 2)], {type: "application/json;charset=utf-8;"});
  var link = document.createElement("a"); link.href = URL.createObjectURL(blob);
  link.download = "patrimoine_global_" + new Date().toISOString().substring(0,10) + ".json";
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function importJSON(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var parsed = JSON.parse(e.target.result);
      if (parsed.pea || parsed.cto) {
        appData = parsed; if(!appData.global_history) appData.global_history = [];
        saveData(appData); alert("✅ Importation réussie !"); location.reload();
      }
    } catch(err) { alert("Erreur fichier JSON."); }
  };
  reader.readAsText(input.files[0]);
}

function resetGlobal() {
  if(confirm('🗑️ Tout supprimer définitivement ?')) { localStorage.removeItem("patrimoine_multi_v6"); location.reload(); }
}

function init() {
  document.getElementById('p_usa').value = appData.pea.prix.usa;
  document.getElementById('p_eu').value = appData.pea.prix.eu;
  document.getElementById('p_em').value = appData.pea.prix.em;
  document.getElementById('budget').value = appData.pea.settings.budget || '';
  document.getElementById('c_usa').value = appData.pea.cibles.usa;
  document.getElementById('c_eu').value = appData.pea.cibles.eu;
  document.getElementById('c_em').value = appData.pea.cibles.em;
  document.getElementById('alerte_seuil').value = appData.pea.settings.alerte_seuil || 5;
  document.getElementById('taux_fisc').value = appData.pea.settings.taux_fisc || 17.2;
  document.getElementById('frais_courtage').value = appData.pea.settings.frais_courtage !== undefined ? appData.pea.settings.frais_courtage : 1.00;
  initDatesFormulaires(); calculerEtAfficherAccueilGlobal();
}

