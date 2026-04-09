const DEMO_PATIENTS = {
  low: {
    Pregnancies: 1,
    Glucose: 92,
    BloodPressure: 68,
    SkinThickness: 18,
    Insulin: 85,
    BMI: 22.4,
    DiabetesPedigreeFunction: 0.25,
    Age: 24,
  },
  medium: {
    Pregnancies: 3,
    Glucose: 135,
    BloodPressure: 74,
    SkinThickness: 29,
    Insulin: 140,
    BMI: 31.8,
    DiabetesPedigreeFunction: 0.48,
    Age: 38,
  },
  high: {
    Pregnancies: 6,
    Glucose: 185,
    BloodPressure: 86,
    SkinThickness: 36,
    Insulin: 210,
    BMI: 39.2,
    DiabetesPedigreeFunction: 0.82,
    Age: 52,
  },
};

const appState = {
  studentName: localStorage.getItem("studentName") || "Your Name",
  rollNumber: localStorage.getItem("rollNumber") || "Roll No. XXXX",
  latestPrediction: null,
};

if (window.mermaid) {
  window.mermaid.initialize({
    startOnLoad: true,
    theme: "neutral",
    securityLevel: "loose",
  });
}

async function loadSummary() {
  const response = await fetch("/api/summary");
  if (!response.ok) {
    throw new Error("Could not load model summary.");
  }

  const data = await response.json();

  document.getElementById("selectedModel").textContent = data.selected_model;
  document.getElementById("selectedAccuracy").textContent =
    `${(data.selected_model_accuracy * 100).toFixed(2)}%`;
  document.getElementById("sampleSplit").textContent =
    `${data.train_size} / ${data.test_size}`;

  renderScoreBars(data.model_scores);
  renderImportanceBars(data.feature_importances);
}

function setBranding(studentName, rollNumber) {
  appState.studentName = studentName;
  appState.rollNumber = rollNumber;

  localStorage.setItem("studentName", studentName);
  localStorage.setItem("rollNumber", rollNumber);

  document.getElementById("brandName").textContent = studentName;
  document.getElementById("brandRoll").textContent = rollNumber;
  document.getElementById("printStudentName").textContent = studentName;
  document.getElementById("printRollNumber").textContent = rollNumber;
}

function showApp() {
  document.getElementById("loginShell").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
}

function fillForm(values) {
  const form = document.getElementById("predictForm");
  Object.entries(values).forEach(([key, value]) => {
    const input = form.elements[key];
    if (input) {
      input.value = value;
    }
  });
}

function updatePrintCard(data) {
  document.getElementById("printRiskLabel").textContent = data.risk_label;
  document.getElementById("printProbability").textContent =
    `${(data.probability * 100).toFixed(2)}%`;
  document.getElementById("printModel").textContent = "Random Forest";
  document.getElementById("printMessage").textContent = data.message;

  const printCard = document.getElementById("printCard");
  printCard.classList.remove("low", "medium", "high");
  if (data.risk_label === "Low Risk") {
    printCard.classList.add("low");
  } else if (data.risk_label === "Moderate Risk") {
    printCard.classList.add("medium");
  } else {
    printCard.classList.add("high");
  }
}

async function runPrediction(values) {
  const response = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Prediction failed.");
  }

  appState.latestPrediction = data;
  updatePrintCard(data);

  const result = document.getElementById("result");
  result.className = "result";
  if (data.risk_label === "Low Risk") {
    result.classList.add("low");
  } else if (data.risk_label === "Moderate Risk") {
    result.classList.add("medium");
  } else {
    result.classList.add("high");
  }

  result.classList.remove("hidden");
  result.innerHTML = `
    <h3>${data.risk_label}</h3>
    <p><strong>Probability:</strong> ${(data.probability * 100).toFixed(2)}%</p>
    <p>${data.message}</p>
  `;
}

function renderScoreBars(scores) {
  const root = document.getElementById("scores");
  root.innerHTML = "";

  Object.entries(scores).forEach(([name, score]) => {
    const item = document.createElement("article");
    item.className = "score-item";

    item.innerHTML = `
      <div class="score-row">
        <strong>${name}</strong>
        <span>${(score * 100).toFixed(2)}%</span>
      </div>
      <div class="bar-wrap">
        <div class="bar" style="width: ${(score * 100).toFixed(2)}%"></div>
      </div>
    `;

    root.appendChild(item);
  });
}

function renderImportanceBars(importances) {
  const root = document.getElementById("importanceBars");
  root.innerHTML = "";

  const maxImportance = Math.max(...importances.map((x) => x.importance));

  importances.forEach((entry) => {
    const widthPct = (entry.importance / maxImportance) * 100;
    const item = document.createElement("article");
    item.className = "importance-item";

    item.innerHTML = `
      <div class="importance-row">
        <strong>${entry.feature}</strong>
        <span>${(entry.importance * 100).toFixed(2)}%</span>
      </div>
      <div class="bar-wrap">
        <div class="bar" style="width: ${widthPct.toFixed(2)}%"></div>
      </div>
    `;

    root.appendChild(item);
  });
}

function bindPredictionForm() {
  const form = document.getElementById("predictForm");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    for (const key of Object.keys(payload)) {
      payload[key] = Number(payload[key]);
    }

    try {
      await runPrediction(payload);
    } catch (error) {
      const result = document.getElementById("result");
      result.className = "result high";
      result.classList.remove("hidden");
      result.innerHTML = `<h3>Error</h3><p>${error.message}</p>`;
    }
  });
}

function bindLoginForm() {
  const loginForm = document.getElementById("loginForm");

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const studentName = String(
      formData.get("studentName") || "Your Name",
    ).trim();
    const rollNumber = String(
      formData.get("rollNumber") || "Roll No. XXXX",
    ).trim();

    setBranding(studentName || "Your Name", rollNumber || "Roll No. XXXX");
    showApp();
  });
}

function bindDemoButtons() {
  document.querySelectorAll(".demo-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const demoKey = button.dataset.demo;
      fillForm(DEMO_PATIENTS[demoKey]);
      try {
        await runPrediction(DEMO_PATIENTS[demoKey]);
      } catch (error) {
        const result = document.getElementById("result");
        result.className = "result high";
        result.classList.remove("hidden");
        result.innerHTML = `<h3>Error</h3><p>${error.message}</p>`;
      }
    });
  });
}

function bindClearButton() {
  document.getElementById("clearDemoBtn").addEventListener("click", () => {
    document.getElementById("predictForm").reset();
    const result = document.getElementById("result");
    result.className = "result hidden";
    result.innerHTML = "";
    document.getElementById("printRiskLabel").textContent =
      "Waiting for result";
    document.getElementById("printProbability").textContent = "-";
    document.getElementById("printMessage").textContent =
      "Run a prediction or a demo sample to generate a presentation-ready result card.";
    document
      .getElementById("printCard")
      .classList.remove("low", "medium", "high");
  });
}

function bindDownloadButton() {
  document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    window.print();
  });
}

(async function init() {
  try {
    setBranding(appState.studentName, appState.rollNumber);
    await loadSummary();
    bindLoginForm();
    bindPredictionForm();
    bindDemoButtons();
    bindClearButton();
    bindDownloadButton();

    if (
      localStorage.getItem("studentName") &&
      localStorage.getItem("rollNumber")
    ) {
      showApp();
    }
  } catch (error) {
    const result = document.getElementById("result");
    result.className = "result high";
    result.classList.remove("hidden");
    result.innerHTML = `<h3>Startup Error</h3><p>${error.message}</p>`;
  }
})();
