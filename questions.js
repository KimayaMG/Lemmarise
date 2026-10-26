(function (global) {
  var MAX = 30;

  function rand(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(0, i);
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // Every possible question for a fresh session. A question is removed from the
  // pool when it is asked, so nothing repeats. Multiplication pairs are stored
  // once (a <= b), so 12 x 27 and 27 x 12 count as the same question.
  // Division: dividend = a x b, divisor = b, answer = a (all from tables 1 to 30).
  function buildPool() {
    var pool = { mul: [], div: [], square: [], cube: [], sqrt: [], cbrt: [] };
    for (var a = 1; a <= MAX; a++) {
      for (var b = 1; b <= MAX; b++) {
        if (a <= b) pool.mul.push([a, b]);
        pool.div.push([a * b, b]);
      }
      pool.square.push(a);
      pool.cube.push(a);
      pool.sqrt.push(a);
      pool.cbrt.push(a);
    }
    return pool;
  }

  function poolSize(pool) {
    return Object.keys(pool).reduce(function (n, t) {
      return n + pool[t].length;
    }, 0);
  }

  function pickOptions(answer, candidates) {
    var seen = {};
    var wrong = candidates.filter(function (c) {
      if (c <= 0 || c === answer || seen[c]) return false;
      seen[c] = true;
      return true;
    });
    var chosen = shuffle(wrong).slice(0, 3);
    var bump = 1;
    while (chosen.length < 3) {
      var c = answer + bump++;
      if (c > 0 && c !== answer && chosen.indexOf(c) === -1) chosen.push(c);
    }
    return shuffle([answer].concat(chosen));
  }

  function makeQuestion(type, item) {
    var text, answer, candidates, n;

    if (type === "mul") {
      var a = item[0];
      var b = item[1];
      answer = a * b;
      // Near misses: one factor too many or too few, or slips in tens or units.
      candidates = [
        answer + a, answer - a, answer + b, answer - b,
        answer + 10, answer - 10, answer + 1, answer - 1,
        answer + 2, answer - 2, answer + 20, answer - 20,
      ];
      if (Math.random() < 0.5) {
        var t = a;
        a = b;
        b = t;
      }
      text = a + " × " + b;
    } else if (type === "div") {
      var dividend = item[0];
      var divisor = item[1];
      answer = dividend / divisor;
      candidates = [-3, -2, -1, 1, 2, 3, 10, -10].map(function (d) {
        return answer + d;
      });
      candidates.push(divisor);
      text = dividend + " ÷ " + divisor;
    } else if (type === "square") {
      n = item;
      answer = n * n;
      text = n + "²";
      candidates = [-3, -2, -1, 1, 2, 3].map(function (d) {
        return Math.pow(n + d, 2);
      });
    } else if (type === "cube") {
      n = item;
      answer = n * n * n;
      text = n + "³";
      candidates = [-3, -2, -1, 1, 2, 3].map(function (d) {
        return Math.pow(n + d, 3);
      });
    } else if (type === "sqrt") {
      n = item;
      answer = n;
      text = "√" + n * n;
      candidates = [-4, -3, -2, -1, 1, 2, 3, 4].map(function (d) {
        return n + d;
      });
    } else {
      n = item;
      answer = n;
      text = "∛" + n * n * n;
      candidates = [-4, -3, -2, -1, 1, 2, 3, 4].map(function (d) {
        return n + d;
      });
    }

    return { type: type, text: text, answer: answer, options: pickOptions(answer, candidates) };
  }

  // Picks a topic evenly among those with questions left, then a random item.
  function drawQuestion(pool) {
    var types = Object.keys(pool).filter(function (t) {
      return pool[t].length > 0;
    });
    if (types.length === 0) return null;
    var type = types[rand(0, types.length - 1)];
    var idx = rand(0, pool[type].length - 1);
    var item = pool[type].splice(idx, 1)[0];
    return makeQuestion(type, item);
  }

  global.LemmariseQuestions = {
    buildPool: buildPool,
    poolSize: poolSize,
    drawQuestion: drawQuestion,
  };
})(typeof window !== "undefined" ? window : globalThis);
