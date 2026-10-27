(function () {
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useCallback = React.useCallback;
  var Q = window.LemmariseQuestions;

  var AUTO_NEXT_MS = 900;
  var SECTIONS = [
    { name: "Arithmetic", note: "Quick recall, " + Q.DEFAULT_TIME + " seconds per question." },
    { name: "Simplification", note: "Bank exam style expressions, with a longer timer per question." },
  ];

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

    var sScreen = useState("menu"); // menu | quiz
    var screen = sScreen[0], setScreen = sScreen[1];
    var sTopic = useState(null);
    var topic = sTopic[0], setTopic = sTopic[1];
    var sQuestion = useState(null);
    var question = sQuestion[0], setQuestion = sQuestion[1];
    var sPhase = useState("question"); // question | correct | wrong
    var phase = sPhase[0], setPhase = sPhase[1];
    var sTimedOut = useState(false);
    var timedOut = sTimedOut[0], setTimedOut = sTimedOut[1];
    var sTime = useState(Q.DEFAULT_TIME);
    var timeLeft = sTime[0], setTimeLeft = sTime[1];
    var sStreak = useState(0);
    var streak = sStreak[0], setStreak = sStreak[1];
    var sBest = useState(0);
    var best = sBest[0], setBest = sBest[1];
    var sAsked = useState(1);
    var asked = sAsked[0], setAsked = sAsked[1];
    var sTotal = useState(0);
    var total = sTotal[0], setTotal = sTotal[1];
    var sFinished = useState(false);
    var finished = sFinished[0], setFinished = sFinished[1];

    // Picking a topic starts a fresh session: new question set, streak and best at 0.
    function startTopic(t) {
      poolRef.current = Q.buildPool(t.keys);
      setTopic(t);
      setTotal(Q.poolSize(poolRef.current));
      setQuestion(Q.drawQuestion(poolRef.current));
      setAsked(1);
      setStreak(0);
      setBest(0);
      setTimedOut(false);
      setFinished(false);
      setPhase("question");
      setScreen("quiz");
    }

    function goMenu() {
      setScreen("menu");
    }

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

    var inQuiz = screen === "quiz" && !finished;

    // Countdown for the current question (its own time limit).
    useEffect(
      function () {
        if (!inQuiz || phase !== "question" || !question) return;
        var limit = question.time;
        var deadline = Date.now() + limit * 1000;
        setTimeLeft(limit);
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
      [question, phase, inQuiz]
    );

    // Move on by itself after a correct answer.
    useEffect(
      function () {
        if (!inQuiz || phase !== "correct") return;
        var id = setTimeout(nextQuestion, AUTO_NEXT_MS);
        return function () { clearTimeout(id); };
      },
      [phase, nextQuestion, inQuiz]
    );

    // Keys 1 to 4 pick the matching option.
    useEffect(
      function () {
        function onKey(e) {
          if (!inQuiz || phase !== "question" || !question) return;
          var i = Number(e.key) - 1;
          if (i >= 0 && i < question.options.length) choose(question.options[i]);
        }
        window.addEventListener("keydown", onKey);
        return function () { window.removeEventListener("keydown", onKey); };
      },
      [inQuiz, phase, question, choose]
    );

    // Keep the page edge colour in step with the screen (mobile overscroll).
    var theme = screen === "menu" || finished ? "question" : phase;
    useEffect(
      function () {
        document.documentElement.setAttribute("data-theme", theme);
      },
      [theme]
    );

    // ----- screens -----

    var content;

    if (screen === "menu") {
      content = h(
        "main",
        { className: "menu" },
        h("p", { className: "menu-title" }, "Choose what to practise"),
        SECTIONS.map(function (sec) {
          var topics = Q.TOPICS.filter(function (t) { return t.section === sec.name; });
          return h(
            "section",
            { key: sec.name, className: "menu-section" },
            h("h2", { className: "menu-heading" }, sec.name),
            h("p", { className: "menu-note" }, sec.note),
            h(
              "div",
              { className: "topics" },
              topics.map(function (t) {
                return h(
                  "button",
                  { key: t.id, className: "topic", onClick: function () { startTopic(t); } },
                  h("span", { className: "topic-label" }, t.label),
                  h("span", { className: "topic-hint" }, t.hint)
                );
              })
            )
          );
        })
      );
    } else {
      var body;
      if (finished) {
        body = h(
          "div",
          { className: "center" },
          h("p", { className: "message" }, "You have answered all " + total + " questions."),
          h("p", { className: "sub" }, "Best streak: " + best),
          h("button", { className: "next", onClick: function () { startTopic(topic); }, autoFocus: true }, "Play this topic again"),
          h("button", { className: "next", onClick: goMenu }, "Choose another topic")
        );
      } else {
        var len = question.text.length;
        var size = len > 26 ? " sm" : len > 12 ? " md" : "";
        body = h(
          React.Fragment,
          null,
          h("p", { className: "count" }, topic.label + " · Question " + asked + " of " + total),
          h(
            "h1",
            { className: "question" + size, "aria-live": "polite" },
            question.plain
              ? question.text
              : [question.text + " ", h("span", { key: "eq", className: "equals" }, "="), " ?"]
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

      content = h(
        React.Fragment,
        null,
        h(
          "header",
          { className: "stats" },
          h(Stat, { label: "Streak", value: streak }),
          h(Stat, { label: "Best", value: best }),
          h(Stat, {
            label: "Time",
            value: finished ? "-" : timeLeft,
            low: phase === "question" && !finished && timeLeft <= 5,
          })
        ),
        h("main", { className: "stage" }, body)
      );
    }

    return h(
      "div",
      { className: "app theme-" + theme },
      h(
        "div",
        { className: "topbar" },
        screen === "quiz"
          ? h("button", { className: "link", onClick: goMenu }, "‹ Topics")
          : h("span", null),
        h("p", { className: "brand" }, "Lemmarise"),
        h("span", null)
      ),
      content,

      h(
        "footer",
        { className: "footer" },
        h(
          "div",
          { className: "topic-label" },
          "Hope this helps. Happy Calculating!"
        ),
        h(
          "div",
          null,
          "Coded with care, by Kimaya.",
          h("br"),
          "Feel free to reach out if you encounter any issues or have feedback.",
          h("br"),
          "You can find me here: ",
          h(
            "a",
            {
              href: "https://kimayamg.github.io/portfolio/",
              target: "_blank",
              rel: "noopener noreferrer"
            },
            "kimayamg.github.io/portfolio"
          )
        )
      )

    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();
