(function () {
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useCallback = React.useCallback;
  var Q = window.LemmariseQuestions;

  var TIME_LIMIT = 27;
  var AUTO_NEXT_MS = 900;
  var TOTAL_QUESTIONS = Q.poolSize(Q.buildPool());

  function Stat(props) {
    return h(
      "div",
      { className: "stat" },
      h("span", { className: "stat-label" }, props.label),
      h("span", { className: "stat-value" + (props.low ? " low" : "") }, props.value)
    );
  }

  function App() {
    var poolRef = useRef(null);
    if (poolRef.current === null) poolRef.current = Q.buildPool();

    var s1 = useState(function () {
      return Q.drawQuestion(poolRef.current);
    });
    var question = s1[0], setQuestion = s1[1];
    var s2 = useState("question"); // question | correct | wrong
    var phase = s2[0], setPhase = s2[1];
    var s3 = useState(false);
    var timedOut = s3[0], setTimedOut = s3[1];
    var s4 = useState(TIME_LIMIT);
    var timeLeft = s4[0], setTimeLeft = s4[1];
    var s5 = useState(0);
    var streak = s5[0], setStreak = s5[1];
    var s6 = useState(0);
    var best = s6[0], setBest = s6[1];
    var s7 = useState(1);
    var asked = s7[0], setAsked = s7[1];
    var s8 = useState(false);
    var finished = s8[0], setFinished = s8[1];

    var nextQuestion = useCallback(function () {
      var q = Q.drawQuestion(poolRef.current);
      if (!q) {
        setFinished(true);
        return;
      }
      setQuestion(q);
      setAsked(function (n) { return n + 1; });
      setTimedOut(false);
      setPhase("question");
    }, []);

    function restart() {
      poolRef.current = Q.buildPool();
      setQuestion(Q.drawQuestion(poolRef.current));
      setAsked(1);
      setStreak(0);
      setBest(0);
      setTimedOut(false);
      setFinished(false);
      setPhase("question");
    }

    var choose = useCallback(
      function (value) {
        if (phase !== "question" || !question) return;
        if (value === question.answer) {
          var next = streak + 1;
          setStreak(next);
          setBest(function (b) { return Math.max(b, next); });
          setPhase("correct");
        } else {
          setStreak(0);
          setPhase("wrong");
        }
      },
      [phase, question, streak]
    );

    // Countdown for the current question.
    useEffect(
      function () {
        if (phase !== "question" || !question) return;
        var deadline = Date.now() + TIME_LIMIT * 1000;
        setTimeLeft(TIME_LIMIT);
        var id = setInterval(function () {
          var left = Math.ceil((deadline - Date.now()) / 1000);
          if (left <= 0) {
            clearInterval(id);
            setTimeLeft(0);
            setTimedOut(true);
            setStreak(0);
            setPhase("wrong");
          } else {
            setTimeLeft(left);
          }
        }, 200);
        return function () { clearInterval(id); };
      },
      [question, phase]
    );

    // Move on by itself after a correct answer.
    useEffect(
      function () {
        if (phase !== "correct") return;
        var id = setTimeout(nextQuestion, AUTO_NEXT_MS);
        return function () { clearTimeout(id); };
      },
      [phase, nextQuestion]
    );

    // Keys 1 to 4 pick the matching option.
    useEffect(
      function () {
        function onKey(e) {
          if (phase !== "question" || !question) return;
          var i = Number(e.key) - 1;
          if (i >= 0 && i < question.options.length) choose(question.options[i]);
        }
        window.addEventListener("keydown", onKey);
        return function () { window.removeEventListener("keydown", onKey); };
      },
      [phase, question, choose]
    );

    // Keep the page edge colour in step with the screen (mobile overscroll).
    var theme = finished ? "question" : phase;
    useEffect(
      function () {
        document.documentElement.setAttribute("data-theme", theme);
      },
      [theme]
    );

    var body;
    if (finished) {
      body = h(
        "div",
        { className: "center" },
        h("p", { className: "message" }, "You have answered all " + TOTAL_QUESTIONS + " questions."),
        h("p", { className: "sub" }, "Best streak: " + best),
        h("button", { className: "next", onClick: restart, autoFocus: true }, "Start a new session")
      );
    } else {
      body = h(
        React.Fragment,
        null,
        h("p", { className: "count" }, "Question " + asked + " of " + TOTAL_QUESTIONS),
        h(
          "h1",
          { className: "question", "aria-live": "polite" },
          question.text + " ",
          h("span", { className: "equals" }, "="),
          " ?"
        ),
        phase === "wrong"
          ? h("p", { className: "message" }, (timedOut ? "Time is up." : "Not quite.") + " The answer is")
          : null,
        phase === "correct" ? h("p", { className: "message" }, "Correct") : null,
        h(
          "div",
          { className: "options" + (phase === "wrong" ? " single" : "") },
          question.options.map(function (opt, i) {
            var isAnswer = opt === question.answer;
            if (phase === "wrong" && !isAnswer) return null;
            return h(
              "button",
              {
                key: opt,
                className: "bubble" + (phase !== "question" && isAnswer ? " is-answer" : ""),
                onClick: function () { choose(opt); },
                disabled: phase !== "question",
              },
              phase === "question" ? h("span", { className: "key" }, i + 1) : null,
              opt
            );
          })
        ),
        phase === "wrong"
          ? h("button", { className: "next", onClick: nextQuestion, autoFocus: true }, "Next question")
          : null
      );
    }

    return h(
      "div",
      { className: "app " + theme },
      h("p", { className: "brand" }, "Lemmarise"),
      h(
        "header",
        { className: "stats" },
        h(Stat, { label: "Streak", value: streak }),
        h(Stat, { label: "Best", value: best }),
        h(Stat, {
          label: "Time",
          value: finished ? "-" : timeLeft,
          low: phase === "question" && timeLeft <= 5,
        })
      ),
      h("main", { className: "stage" }, body),
      h(
        "footer",
        { className: "footer" },
        "Hope this helps. Made with care, by Kimaya. ",
        h(
          "a",
          { href: "https://kimayamg.github.io/portfolio/", target: "_blank", rel: "noopener noreferrer" },
          "kimayamg.github.io/portfolio"
        )
      )
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();
