import React from "react";

// Same building blocks as the RM app (frontend/src/App.jsx).
export function SectionTitle({ title, sub }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

export function Review({ title, rows }) {
  return (
    <div className="review">
      <div className="review-heading">
        <h3>{title}</h3>
      </div>
      {Object.entries(rows).map(([k, v]) => (
        <div className="review-row" key={k}>
          <span>{k}</span>
          <b>{String(v || "-")}</b>
        </div>
      ))}
    </div>
  );
}

export const rupees = (paise, decimals = 2) =>
  (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
