export function createUnitFilter(filter, onChange) {
  const summary = filter.querySelector("summary");
  const summaryText = filter.querySelector("#unidadeFilterSummary");
  const options = filter.querySelector("#unidadeFilterOptions");

  function selected() {
    return new Set(Array.from(options.querySelectorAll("input:checked"), input => input.value));
  }

  function updateSummary() {
    const units = selected();
    summaryText.textContent = units.size > 1
      ? units.size + " selecionadas"
      : [...units][0] || "Todas";
  }

  function setOptions(units) {
    const previous = selected();
    const entries = units.map(unit => {
      const label = document.createElement("label");
      label.className = "multi-filter-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = unit;
      input.checked = previous.has(unit);
      label.append(input, unit);
      return label;
    });
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "multi-filter-empty mb-0";
      empty.textContent = "Nenhuma unidade disponível.";
      entries.push(empty);
    }
    options.replaceChildren(...entries);
    updateSummary();
  }

  function clear() {
    const restoreFocus = filter.contains(document.activeElement);
    options.querySelectorAll("input:checked").forEach(input => input.checked = false);
    filter.open = false;
    updateSummary();
    if (restoreFocus) summary.focus();
  }

  options.addEventListener("change", () => {
    updateSummary();
    onChange();
  });
  filter.querySelector("#resetUnidades").addEventListener("click", () => {
    clear();
    onChange();
  });
  document.addEventListener("click", event => {
    if (filter.open && !filter.contains(event.target)) filter.open = false;
  });
  filter.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !filter.open) return;
    event.preventDefault();
    filter.open = false;
    summary.focus();
  });

  return { selected, setOptions, clear };
}
