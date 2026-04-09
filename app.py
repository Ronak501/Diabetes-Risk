from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

DATA_URL = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"
FEATURE_COLUMNS = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]
TARGET_COLUMN = "Outcome"


@dataclass
class ModelArtifacts:
    scaler: StandardScaler
    best_model: RandomForestClassifier
    model_scores: Dict[str, float]
    feature_importances: List[Dict[str, float]]
    test_accuracy: float
    train_size: int
    test_size: int


def train_pipeline() -> ModelArtifacts:
    columns = FEATURE_COLUMNS + [TARGET_COLUMN]
    df = pd.read_csv(DATA_URL, names=columns)

    cols_to_fix = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]
    df[cols_to_fix] = df[cols_to_fix].replace(0, np.nan)
    df.fillna(df.median(numeric_only=True), inplace=True)

    x = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000),
        "Decision Tree": DecisionTreeClassifier(max_depth=5, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=200, random_state=42),
    }

    model_scores: Dict[str, float] = {}
    for name, model in models.items():
        model.fit(x_train_scaled, y_train)
        preds = model.predict(x_test_scaled)
        model_scores[name] = float(accuracy_score(y_test, preds))

    best_model = models["Random Forest"]
    rf_preds = best_model.predict(x_test_scaled)
    rf_accuracy = float(accuracy_score(y_test, rf_preds))

    importances = best_model.feature_importances_
    feature_importances = [
        {"feature": feature, "importance": float(importance)}
        for feature, importance in sorted(
            zip(FEATURE_COLUMNS, importances), key=lambda item: item[1], reverse=True
        )
    ]

    return ModelArtifacts(
        scaler=scaler,
        best_model=best_model,
        model_scores=model_scores,
        feature_importances=feature_importances,
        test_accuracy=rf_accuracy,
        train_size=int(len(x_train)),
        test_size=int(len(x_test)),
    )


def risk_label(probability: float) -> str:
    if probability >= 0.7:
        return "High Risk"
    if probability >= 0.4:
        return "Moderate Risk"
    return "Low Risk"


app = Flask(__name__)
artifacts = train_pipeline()


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/summary")
def summary():
    return jsonify(
        {
            "model_scores": artifacts.model_scores,
            "selected_model": "Random Forest",
            "selected_model_accuracy": artifacts.test_accuracy,
            "train_size": artifacts.train_size,
            "test_size": artifacts.test_size,
            "features": FEATURE_COLUMNS,
            "feature_importances": artifacts.feature_importances,
        }
    )


@app.post("/api/predict")
def predict():
    body = request.get_json(silent=True) or {}

    values = []
    missing = []
    for field in FEATURE_COLUMNS:
        if field not in body:
            missing.append(field)
            continue

        try:
            values.append(float(body[field]))
        except (TypeError, ValueError):
            return jsonify({"error": f"Invalid numeric value for {field}."}), 400

    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    input_array = np.array(values, dtype=float).reshape(1, -1)
    scaled = artifacts.scaler.transform(input_array)

    prediction = int(artifacts.best_model.predict(scaled)[0])
    probability = float(artifacts.best_model.predict_proba(scaled)[0][1])

    return jsonify(
        {
            "prediction": prediction,
            "probability": probability,
            "risk_label": risk_label(probability),
            "message": (
                "Diabetes likely detected." if prediction == 1 else "Diabetes not detected."
            ),
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
