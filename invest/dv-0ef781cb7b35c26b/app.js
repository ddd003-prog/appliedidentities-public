(function () {
  'use strict';

  /* ---------------------------------------------------------------
   * Per-recipient token + personalization (privacy-by-obscurity).
   * ?v= identifies the recipient for analytics; ?name= personalizes.
   * Everything read from the URL is sanitized before touching the DOM.
   * ------------------------------------------------------------- */
  function sanitize(raw) {
    if (!raw) return '';
    // Strip anything that is not a letter, number, space, hyphen, period, apostrophe.
    return String(raw).replace(/[^A-Za-z0-9 .'-]/g, '').trim().slice(0, 60);
  }

  function readToken() {
    try {
      var params = new URLSearchParams(window.location.search);
      var v = sanitize(params.get('v'));
      var name = sanitize(params.get('name'));

      // Tag the analytics pageview with the recipient token (custom prop).
      if (window.plausible) {
        window.plausible('pageview', { props: { recipient: v || 'unknown' } });
      }

      // Personalize the confidential line if a name was supplied.
      if (name) {
        var line = document.getElementById('confidential-line');
        if (line) {
          line.textContent = 'Private and confidential. Prepared for ' + name + '.';
        }
      }
    } catch (e) { /* never break the page on a bad URL */ }
  }

  /* ---------------------------------------------------------------
   * Value-recognition simulator
   * ------------------------------------------------------------- */

  // Public-safe constants
  var RECOGNITION_WEIGHT = [0.35, 0.58, 0.78, 0.94];
  var EXPANSION_FRACTION = [0.00, 0.06, 0.12, 0.18];
  var VERIFY_LABELS = ['Internal claim', 'In production', 'Independently audited', 'Insurer-grade'];
  var G = 0.30;            // emergent compounding rate per year
  var CAP_MULTIPLE = 6;    // capitalization multiple

  // Brand palette
  var SLATE  = '#4F5D75';
  var SIGNAL = '#2E6DA4';
  var AMBER  = '#D4A03C';

  var ids = ['agents', 'valuePer', 'attainment', 'capture', 'verify', 'hold', 'entry'];
  var els = {};
  var chartA = null, chartB = null;

  function $(id) { return document.getElementById(id); }
  function round0(n) { return Math.round(n); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function readInputs() {
    return {
      agents:     parseInt(els.agents.value, 10),
      valuePer:   parseInt(els.valuePer.value, 10),     // $K per agent / yr
      attainment: parseInt(els.attainment.value, 10),   // %
      capture:    parseInt(els.capture.value, 10),      // %
      stop:       parseInt(els.verify.value, 10),       // 0..3
      hold:       parseInt(els.hold.value, 10),         // years
      entry:      parseInt(els.entry.value, 10)         // $M
    };
  }

  function compute(v) {
    // All money in $M.
    var S0 = v.agents * (v.valuePer / 1000) * (v.attainment / 100);

    var specified = [], emergent = [], total = [];
    for (var t = 0; t <= v.hold; t++) {
      var em = S0 * (Math.pow(1 + G, t) - 1);
      specified.push(S0);
      emergent.push(em);
      total.push(S0 + em);
    }

    var emergentExit = S0 * (Math.pow(1 + G, v.hold) - 1);
    var delivered = S0 + emergentExit;
    var captured = delivered * (v.capture / 100);
    var recognitionWeight = RECOGNITION_WEIGHT[v.stop];
    var recognizedAnnual = captured * recognitionWeight;
    var createdValue = recognizedAnnual * CAP_MULTIPLE;
    var expansion = v.entry * EXPANSION_FRACTION[v.stop];
    var exitValue = v.entry + createdValue + expansion;
    var emergentShare = delivered > 0 ? (emergentExit / delivered) : 0;

    return {
      S0: S0,
      specified: specified, emergent: emergent, total: total,
      emergentExit: emergentExit, delivered: delivered,
      createdValue: createdValue, expansion: expansion,
      exitValue: exitValue, emergentShare: emergentShare,
      recognitionWeight: recognitionWeight
    };
  }

  function updateLabels(v) {
    els['agents-val'].textContent     = v.agents;
    els['valuePer-val'].textContent   = v.valuePer;
    els['attainment-val'].textContent = v.attainment;
    els['capture-val'].textContent    = v.capture;
    els['hold-val'].textContent       = v.hold;
    els['entry-val'].textContent      = v.entry;
    els['verify-val'].textContent     = VERIFY_LABELS[v.stop];
  }

  function updateMetrics(v, r) {
    $('m-delivered').textContent = '$' + round0(r.delivered) + 'M';
    $('m-delivered-sub').textContent =
      '$' + round1(r.S0) + ' specified + $' + round1(r.emergentExit) + ' emergent';

    $('m-emergent').textContent = round0(r.emergentShare * 100) + '%';

    $('m-recognized').textContent = '$' + round0(r.createdValue) + 'M';

    $('m-exit').textContent = '$' + round0(r.exitValue) + 'M';
    var pct = v.entry > 0 ? round0(((r.exitValue - v.entry) / v.entry) * 100) : 0;
    $('m-exit-sub').textContent = '+' + pct + '% vs entry';

    var pctCredit = round0(r.recognitionWeight * 100);
    $('verify-caption').textContent =
      VERIFY_LABELS[v.stop] + '. The market credits about ' + pctCredit + '% of captured value.';
  }

  // ---- Chart A: stacked compounding trajectory ----
  function buildChartA(v, r) {
    var labels = [];
    for (var t = 0; t <= v.hold; t++) labels.push('Yr ' + t);

    var data = {
      labels: labels,
      datasets: [
        {
          label: 'Specified value',
          data: r.specified.map(round1),
          borderColor: SLATE,
          backgroundColor: 'rgba(79,93,117,0.55)',
          fill: 'origin',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0
        },
        {
          label: 'Emergent value (surfaced by continuous measurement)',
          data: r.total.map(round1),
          borderColor: SIGNAL,
          backgroundColor: 'rgba(46,109,164,0.45)',
          borderDash: [6, 4],
          fill: '-1',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0
        }
      ]
    };

    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: SLATE, boxWidth: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            // Series 1 plots specified[]; series 2 plots total[] (specified+emergent)
            // so it can fill down to series 1. Report each band's own value.
            label: function (ctx) {
              if (ctx.datasetIndex === 1) {
                var spec = ctx.chart.data.datasets[0].data[ctx.dataIndex];
                var band = round1(ctx.parsed.y - spec);
                return 'Emergent value: $' + band + 'M';
              }
              return ctx.dataset.label + ': $' + ctx.parsed.y + 'M';
            }
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Value ($M)', color: SLATE },
          ticks: { color: SLATE, callback: function (val) { return '$' + val + 'M'; } },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        x: { ticks: { color: SLATE }, grid: { display: false } }
      }
    };

    if (chartA) {
      chartA.data = data;
      chartA.update();
    } else {
      chartA = new Chart($('chartA').getContext('2d'), { type: 'line', data: data, options: opts });
    }
  }

  // ---- Chart B: floating waterfall bridge ----
  function buildChartB(v, r) {
    var entry = round0(v.entry);
    var created = round0(r.createdValue);
    var expansion = round0(r.expansion);
    var exit = round0(r.exitValue);

    var a = entry;
    var b = entry + created;
    var c = exit; // entry + created + expansion (rounded to exit for connector consistency)

    var data = {
      labels: ['Entry value', 'Recognized value', 'Multiple expansion', 'Exit value'],
      datasets: [{
        label: 'Value bridge ($M)',
        data: [
          [0, entry],
          [entry, b],
          [b, c],
          [0, exit]
        ],
        backgroundColor: [SLATE, SIGNAL, AMBER, SLATE],
        borderWidth: 0,
        borderSkipped: false,
        barPercentage: 0.7
      }]
    };

    // Connector + value-label plugin
    var bridgePlugin = {
      id: 'bridgeAnnotations',
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var meta = chart.getDatasetMeta(0);
        var tops = [entry, b, c, exit];   // visible top of each bar
        ctx.save();
        ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
        ctx.fillStyle = '#0A1628';
        ctx.textAlign = 'center';
        // value labels above each bar
        var vals = [entry, created, expansion, exit];
        var prefixes = ['$', '+$', '+$', '$'];
        for (var i = 0; i < meta.data.length; i++) {
          var bar = meta.data[i];
          ctx.fillText(prefixes[i] + vals[i] + 'M', bar.x, bar.y - 8);
        }
        // connector lines between consecutive bar tops
        ctx.strokeStyle = 'rgba(10,22,40,0.3)';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        for (var j = 0; j < meta.data.length - 1; j++) {
          var cur = meta.data[j];
          var nxt = meta.data[j + 1];
          var y = chart.scales.y.getPixelForValue(tops[j]);
          ctx.beginPath();
          ctx.moveTo(cur.x, y);
          ctx.lineTo(nxt.x, y);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var range = ctx.raw;
              return '$' + Math.abs(range[1] - range[0]) + 'M';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Enterprise value ($M)', color: SLATE },
          ticks: { color: SLATE, callback: function (val) { return '$' + val + 'M'; } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          grace: '12%'
        },
        x: { ticks: { color: SLATE, font: { size: 11 } }, grid: { display: false } }
      }
    };

    if (chartB) {
      chartB.data = data;
      chartB.update();
    } else {
      chartB = new Chart($('chartB').getContext('2d'), {
        type: 'bar', data: data, options: opts, plugins: [bridgePlugin]
      });
    }
  }

  function recompute() {
    var v = readInputs();
    var r = compute(v);
    updateLabels(v);
    updateMetrics(v, r);
    buildChartA(v, r);
    buildChartB(v, r);
  }

  function init() {
    // cache elements
    ids.forEach(function (id) { els[id] = $(id); });
    ['agents-val','valuePer-val','attainment-val','capture-val','hold-val','entry-val','verify-val']
      .forEach(function (id) { els[id] = $(id); });

    ids.forEach(function (id) {
      els[id].addEventListener('input', recompute);
    });

    readToken();

    if (typeof Chart === 'undefined') {
      // Chart.js loads deferred; wait until it is ready.
      window.addEventListener('load', recompute);
    } else {
      recompute();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
