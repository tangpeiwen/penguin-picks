const MEAL_OPTIONS = [
  { id: "any", label: "不限" },
  { id: "brunch", label: "Brunch" },
  { id: "lunch", label: "中饭" },
  { id: "dinner", label: "晚饭" },
  { id: "late-night", label: "夜宵" }
];

const MEAL_LABELS = MEAL_OPTIONS.reduce((labels, item) => {
  labels[item.id] = item.label;
  return labels;
}, {});

module.exports = { MEAL_OPTIONS, MEAL_LABELS };
