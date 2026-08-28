import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Users, Sparkles, Package, ClipboardList, BarChart3, X, Save, Pencil, Check, Calendar, ChevronLeft, ChevronRight, Wallet, Search } from "lucide-react";

const STORAGE_KEY = "app-data";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const todayStr = () => new Date().toISOString().slice(0, 10);

const nowTimeStr = () => {
  const d = new Date();
  const mins = d.getMinutes() < 30 ? "00" : "30";
  return `${String(d.getHours()).padStart(2, "0")}:${mins}`;
};

// Список времени с шагом 30 минут на весь день
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const fmt = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const SOURCES = ["Avito", "Telegram", "Instagram", "WhatsApp", "Сарафанное радио", "Другое"];
const STATUSES = ["Записался", "Пришёл", "Не пришёл"];
const SERVICE_TYPES = ["Процедуры", "Обучение"];
const EXPENSE_CATEGORIES = ["Реклама", "Продвижение", "Сервисы/подписки", "Аренда", "Зарплата", "Другое"];

const EXPENSE_CATEGORY_COLORS = {
  "Реклама": { bg: "#FBE4E4", fg: "#C23B3B" },
  "Продвижение": { bg: "#E1EEFF", fg: "#1D5FD6" },
  "Сервисы/подписки": { bg: "#F1E9FB", fg: "#7A3FC4" },
  "Аренда": { bg: "#FFF3CC", fg: "#8A6D00" },
  "Зарплата": { bg: "#E1F6E7", fg: "#1F8F4E" },
  "Другое": { bg: "#F1EDE9", fg: "#7A6F66" },
};

const SOURCE_COLORS = {
  "Avito": { bg: "#FBE4E4", fg: "#C23B3B" },
  "Telegram": { bg: "#E1EEFF", fg: "#1D5FD6" },
  "Instagram": { bg: "#FCE7F3", fg: "#C0267A" },
  "WhatsApp": { bg: "#E1F6E7", fg: "#1F8F4E" },
  "Сарафанное радио": { bg: "#FFF3CC", fg: "#8A6D00" },
  "Другое": { bg: "#F1EDE9", fg: "#7A6F66" },
};

const STATUS_COLORS = {
  "Записался": { bg: "#FFF3CC", fg: "#8A6D00" },
  "Пришёл": { bg: "#E1F6E7", fg: "#1F8F4E" },
  "Не пришёл": { bg: "#FBE4E4", fg: "#C23B3B" },
};

const SERVICE_TYPE_COLORS = {
  "Процедуры": { bg: "#F3E3E6", fg: "#8F4A5A" },
  "Обучение": { bg: "#FFF2DA", fg: "#9A6B12" },
};

const VISIT_STATUSES = ["Запланировано", "Выполнено"];
const VISIT_STATUS_COLORS = {
  "Запланировано": { bg: "#FFF3CC", fg: "#8A6D00" },
  "Выполнено": { bg: "#E1F6E7", fg: "#1F8F4E" },
};

function ColorBadge({ text, colorMap }) {
  const c = colorMap[text] || { bg: "#EFEAE6", fg: "#6B5F5A" };
  return (
    <span style={{ background: c.bg, color: c.fg, padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

// Для произвольных названий процедур/материалов — стабильный цвет по хэшу текста
const HASH_PALETTE = [
  { bg: "#F3E3E6", fg: "#8F4A5A" },
  { bg: "#E9F1FF", fg: "#2A5ADB" },
  { bg: "#E5F8EC", fg: "#1F8F4E" },
  { bg: "#FFF2DA", fg: "#9A6B12" },
  { bg: "#F1E9FB", fg: "#7A3FC4" },
  { bg: "#FCE7F3", fg: "#C0267A" },
  { bg: "#E6F4FF", fg: "#0B84D9" },
];

function hashColor(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return HASH_PALETTE[hash % HASH_PALETTE.length];
}

function AutoColorBadge({ text }) {
  const c = hashColor(text || "");
  return (
    <span style={{ background: c.bg, color: c.fg, padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function unitCostOf(m) {
  const qty = Number(m.packageQty) || 0;
  const cost = Number(m.packageCost) || 0;
  return qty > 0 ? cost / qty : 0;
}

const UNIT_OPTIONS = ["шт", "мл", "г", "уп", "пара", "ед"];

const emptyData = {
  clients: [],
  services: [],
  materials: [],
  visits: [],
  expenses: [],
  expenseCategories: [...EXPENSE_CATEGORIES],
  roomHourRate: 600,
};

export default function App() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("clients");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const saveTimer = useRef(null);
  const [confirmState, setConfirmState] = useState(null); // { message, onConfirm }

  const requestConfirm = (message, onConfirm) => setConfirmState({ message, onConfirm });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setData({ ...emptyData, ...parsed });
      }
    } catch (e) {
      // no saved data yet, start fresh
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const tabs = [
    { id: "clients", label: "Клиенты", icon: Users },
    { id: "visits", label: "Записи", icon: ClipboardList },
    { id: "services", label: "Услуги", icon: Sparkles },
    { id: "finance", label: "Финансы", icon: Wallet },
    { id: "materials", label: "Материалы", icon: Package },
    { id: "calendar", label: "Календарь", icon: Calendar },
    { id: "dashboard", label: "Дашборд", icon: BarChart3 },
  ];

  if (!loaded) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Загрузка данных…</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Учёт кабинета</div>
          <h1 style={styles.h1}>Клиенты · Процедуры · Финансы</h1>
        </div>
        <div style={styles.saveIndicator}>
          {saveState === "saving" && "Сохранение…"}
          {saveState === "saved" && "✓ Сохранено"}
          {saveState === "error" && "Не удалось сохранить"}
        </div>
      </header>

      <nav style={styles.nav}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...styles.navBtn, ...(active ? styles.navBtnActive : {}) }}
            >
              <Icon size={16} style={{ marginRight: 6 }} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <main style={styles.main}>
        {tab === "clients" && <ClientsTab data={data} update={update} confirm={requestConfirm} />}
        {tab === "visits" && <VisitsTab data={data} update={update} confirm={requestConfirm} />}
        {tab === "services" && <ServicesTab data={data} update={update} confirm={requestConfirm} />}
        {tab === "finance" && <FinanceTab data={data} update={update} confirm={requestConfirm} />}
        {tab === "materials" && <MaterialsTab data={data} update={update} confirm={requestConfirm} />}
        {tab === "calendar" && <CalendarTab data={data} />}
        {tab === "dashboard" && <DashboardTab data={data} />}
      </main>

      {confirmState && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalMessage}>{confirmState.message}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                style={{ ...styles.primaryBtn, background: "#B23A3A" }}
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
              >
                Удалить
              </button>
              <button
                style={{ ...styles.primaryBtn, background: "#fff", color: palette.subtext, border: `1px solid ${palette.border}` }}
                onClick={() => setConfirmState(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- CLIENTS ---------------- */
function ClientsTab({ data, update, confirm }) {
  const emptyForm = {
    contactDate: todayStr(),
    name: "",
    phone: "",
    source: SOURCES[0],
    status: STATUSES[0],
    serviceType: SERVICE_TYPES[0],
    blacklisted: false,
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const addClient = () => {
    if (!form.name.trim()) return;
    update({ clients: [{ id: uid(), ...form }, ...data.clients] });
    setForm({ ...emptyForm, contactDate: todayStr() });
  };

  const removeClient = (id) => {
    confirm("Удалить этого клиента? Это действие нельзя отменить.", () => {
      update({ clients: data.clients.filter((c) => c.id !== id) });
    });
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({
      contactDate: c.contactDate || "",
      name: c.name,
      phone: c.phone || "",
      source: c.source,
      status: c.status || STATUSES[0],
      serviceType: c.serviceType || SERVICE_TYPES[0],
      blacklisted: !!c.blacklisted,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = (id) => {
    if (!editForm.name.trim()) return;
    update({ clients: data.clients.map((c) => (c.id === id ? { ...c, ...editForm } : c)) });
    cancelEdit();
  };

  return (
    <div>
      <SectionTitle title="Клиенты" subtitle="Имя, телефон, источник, статус визита и тип услуги" />
      <div style={styles.formRow}>
        <input
          style={{ ...styles.input, maxWidth: 150 }}
          type="date"
          value={form.contactDate}
          onChange={(e) => setForm({ ...form, contactDate: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Имя клиента"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Телефон"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <select style={styles.input} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select style={styles.input} value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button style={styles.primaryBtn} onClick={addClient}>
          <Plus size={16} /> Добавить
        </button>
      </div>

      <Table
        columns={["Дата обращения", "Имя", "Телефон", "Источник", "Статус", "Услуга", ""]}
        rows={data.clients.map((c) => {
          if (editingId === c.id) {
            return [
              <input style={{ ...styles.input, minWidth: 130 }} type="date" value={editForm.contactDate} onChange={(e) => setEditForm({ ...editForm, contactDate: e.target.value })} />,
              <input style={{ ...styles.input, minWidth: 110 }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />,
              <input style={{ ...styles.input, minWidth: 110 }} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />,
              <select style={{ ...styles.input, minWidth: 120 }} value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>,
              <select style={{ ...styles.input, minWidth: 110 }} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>,
              <select style={{ ...styles.input, minWidth: 110 }} value={editForm.serviceType} onChange={(e) => setEditForm({ ...editForm, serviceType: e.target.value })}>
                {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>,
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: palette.subtext, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={editForm.blacklisted} onChange={(e) => setEditForm({ ...editForm, blacklisted: e.target.checked })} />
                  ЧС
                </label>
                <button style={styles.iconBtn} onClick={() => saveEdit(c.id)}><Check size={14} /></button>
                <button style={styles.iconBtn} onClick={cancelEdit}><X size={14} /></button>
              </div>,
            ];
          }
          return [
            c.contactDate || "—",
            <span style={c.blacklisted ? { color: "#B23A3A", fontWeight: 700 } : {}}>
              {c.blacklisted ? "🚫 " : ""}
              {c.name}
            </span>,
            c.phone || "—",
            <ColorBadge text={c.source} colorMap={SOURCE_COLORS} />,
            <ColorBadge text={c.status || STATUSES[0]} colorMap={STATUS_COLORS} />,
            <ColorBadge text={c.serviceType || SERVICE_TYPES[0]} colorMap={SERVICE_TYPE_COLORS} />,
            <div style={{ display: "flex", gap: 4 }}>
              <button style={styles.iconBtn} onClick={() => startEdit(c)}><Pencil size={14} /></button>
              <button style={styles.iconBtn} onClick={() => removeClient(c.id)}><Trash2 size={14} /></button>
            </div>,
          ];
        })}
        empty="Пока нет ни одного клиента"
      />
    </div>
  );
}

/* ---------------- SERVICES ---------------- */
function ServicesTab({ data, update, confirm }) {
  const [form, setForm] = useState({ name: "", price: "", cost: "", type: SERVICE_TYPES[0], linkedProcedureId: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const procedureOptions = data.services.filter((s) => (s.type || SERVICE_TYPES[0]) === "Процедуры");

  const addService = () => {
    if (!form.name.trim() || !form.price) return;
    update({
      services: [
        {
          id: uid(),
          name: form.name,
          price: Number(form.price),
          cost: Number(form.cost) || 0,
          type: form.type,
          linkedProcedureId: form.type === "Обучение" ? form.linkedProcedureId || "" : "",
        },
        ...data.services,
      ],
    });
    setForm({ name: "", price: "", cost: "", type: form.type, linkedProcedureId: "" });
  };

  const removeService = (id) => {
    confirm("Удалить эту услугу? Это действие нельзя отменить.", () => {
      update({ services: data.services.filter((s) => s.id !== id) });
    });
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      price: s.price,
      cost: s.cost || 0,
      type: s.type || SERVICE_TYPES[0],
      linkedProcedureId: s.linkedProcedureId || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = (id) => {
    if (!editForm.name.trim() || !editForm.price) return;
    update({
      services: data.services.map((s) =>
        s.id === id
          ? {
              ...s,
              name: editForm.name,
              price: Number(editForm.price),
              cost: Number(editForm.cost) || 0,
              type: editForm.type,
              linkedProcedureId: editForm.type === "Обучение" ? editForm.linkedProcedureId || "" : "",
            }
          : s
      ),
    });
    cancelEdit();
  };

  const procedureName = (id) => data.services.find((s) => s.id === id)?.name;

  return (
    <div>
      <SectionTitle
        title="Услуги / процедуры"
        subtitle="Тип «Обучение» можно привязать к сохранённой процедуре и задать для него отдельную цену — материалы в записи для него отключаются"
      />
      <div style={styles.formRow}>
        <input
          style={styles.input}
          placeholder="Название процедуры"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select style={{ ...styles.input, maxWidth: 140 }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, linkedProcedureId: "" })}>
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {form.type === "Обучение" && (
          <select
            style={{ ...styles.input, maxWidth: 200 }}
            value={form.linkedProcedureId}
            onChange={(e) => setForm({ ...form, linkedProcedureId: e.target.value })}
          >
            <option value="">Не привязано к процедуре</option>
            {procedureOptions.map((p) => (
              <option key={p.id} value={p.id}>На основе: {p.name}</option>
            ))}
          </select>
        )}
        <input
          style={styles.input}
          placeholder="Цена, ₽"
          type="number"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Себестоимость услуги, ₽ (необязательно)"
          type="number"
          value={form.cost}
          onChange={(e) => setForm({ ...form, cost: e.target.value })}
        />
        <button style={styles.primaryBtn} onClick={addService}>
          <Plus size={16} /> Добавить
        </button>
      </div>

      <Table
        columns={["Процедура", "Тип", "На основе процедуры", "Цена", "Себестоимость услуги", ""]}
        rows={data.services.map((s) => {
          if (editingId === s.id) {
            const editProcedureOptions = data.services.filter((x) => (x.type || SERVICE_TYPES[0]) === "Процедуры" && x.id !== s.id);
            return [
              <input style={{ ...styles.input, minWidth: 130 }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />,
              <select style={{ ...styles.input, minWidth: 110 }} value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value, linkedProcedureId: "" })}>
                {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>,
              editForm.type === "Обучение" ? (
                <select style={{ ...styles.input, minWidth: 150 }} value={editForm.linkedProcedureId} onChange={(e) => setEditForm({ ...editForm, linkedProcedureId: e.target.value })}>
                  <option value="">Не привязано</option>
                  {editProcedureOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : "—",
              <input style={{ ...styles.input, minWidth: 90 }} type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />,
              <input style={{ ...styles.input, minWidth: 110 }} type="number" value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} />,
              <div style={{ display: "flex", gap: 4 }}>
                <button style={styles.iconBtn} onClick={() => saveEdit(s.id)}><Check size={14} /></button>
                <button style={styles.iconBtn} onClick={cancelEdit}><X size={14} /></button>
              </div>,
            ];
          }
          return [
            s.name,
            <ColorBadge text={s.type || SERVICE_TYPES[0]} colorMap={SERVICE_TYPE_COLORS} />,
            s.type === "Обучение" && s.linkedProcedureId ? (procedureName(s.linkedProcedureId) || "—") : "—",
            `${fmt(s.price)} ₽`,
            s.cost ? `${fmt(s.cost)} ₽` : "—",
            <div style={{ display: "flex", gap: 4 }}>
              <button style={styles.iconBtn} onClick={() => startEdit(s)}><Pencil size={14} /></button>
              <button style={styles.iconBtn} onClick={() => removeService(s.id)}><Trash2 size={14} /></button>
            </div>,
          ];
        })}
        empty="Добавьте первую услугу, чтобы использовать её в записях"
      />
    </div>
  );
}

/* ---------------- MATERIALS ---------------- */
function MaterialsTab({ data, update, confirm }) {
  const emptyForm = {
    serviceIds: data.services[0] ? [data.services[0].id] : [],
    name: "",
    country: "",
    unit: "шт",
    packageQty: "",
    packageCost: "",
    retailPrice: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const toggleServiceId = (list, id) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const addMaterial = () => {
    if (form.serviceIds.length === 0 || !form.name.trim() || !form.packageQty || !form.packageCost) return;
    update({
      materials: [
        {
          id: uid(),
          serviceIds: form.serviceIds,
          name: form.name,
          country: form.country,
          unit: form.unit,
          packageQty: Number(form.packageQty),
          packageCost: Number(form.packageCost),
          retailPrice: Number(form.retailPrice) || 0,
        },
        ...data.materials,
      ],
    });
    setForm({ ...emptyForm, serviceIds: form.serviceIds });
  };

  const removeMaterial = (id) => {
    confirm("Удалить этот материал? Это действие нельзя отменить.", () => {
      update({ materials: data.materials.filter((m) => m.id !== id) });
    });
  };

  const serviceNames = (ids) =>
    (ids || []).map((id) => data.services.find((s) => s.id === id)?.name).filter(Boolean);

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditForm({
      serviceIds: m.serviceIds || (m.serviceId ? [m.serviceId] : []),
      name: m.name,
      country: m.country || "",
      unit: m.unit,
      packageQty: m.packageQty,
      packageCost: m.packageCost,
      retailPrice: m.retailPrice || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = (id) => {
    if (!editForm.serviceIds.length || !editForm.name.trim() || !editForm.packageQty || !editForm.packageCost) return;
    update({
      materials: data.materials.map((m) =>
        m.id === id
          ? {
              ...m,
              serviceIds: editForm.serviceIds,
              name: editForm.name,
              country: editForm.country,
              unit: editForm.unit,
              packageQty: Number(editForm.packageQty),
              packageCost: Number(editForm.packageCost),
              retailPrice: Number(editForm.retailPrice) || 0,
            }
          : m
      ),
    });
    cancelEdit();
  };

  return (
    <div>
      <SectionTitle
        title="Материалы и расходники"
        subtitle="Можно привязать материал сразу к нескольким услугам — отметьте нужные"
      />

      {data.services.length === 0 ? (
        <div style={styles.hint}>Сначала добавьте хотя бы одну услугу во вкладке «Услуги» — материалы привязываются к ним.</div>
      ) : (
        <>
          <div style={styles.formRow}>
            <div style={styles.serviceCheckboxBox}>
              <div style={styles.serviceCheckboxLabel}>Услуги:</div>
              {data.services.map((s) => (
                <label key={s.id} style={styles.serviceCheckboxItem}>
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(s.id)}
                    onChange={() => setForm({ ...form, serviceIds: toggleServiceId(form.serviceIds, s.id) })}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <div style={styles.formRow}>
            <input
              style={styles.input}
              placeholder="Название препарата"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              style={{ ...styles.input, maxWidth: 140 }}
              placeholder="Страна происхождения"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
            <select
              style={{ ...styles.input, maxWidth: 90 }}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <input
              style={{ ...styles.input, maxWidth: 130 }}
              placeholder="Количество (напр. 100)"
              type="number"
              value={form.packageQty}
              onChange={(e) => setForm({ ...form, packageQty: e.target.value })}
            />
            <input
              style={{ ...styles.input, maxWidth: 150 }}
              placeholder="Стоимость всего, ₽"
              type="number"
              value={form.packageCost}
              onChange={(e) => setForm({ ...form, packageCost: e.target.value })}
            />
            <input
              style={{ ...styles.input, maxWidth: 170 }}
              placeholder="Розничная цена за ед., ₽"
              type="number"
              value={form.retailPrice}
              onChange={(e) => setForm({ ...form, retailPrice: e.target.value })}
            />
            <button style={styles.primaryBtn} onClick={addMaterial}>
              <Plus size={16} /> Добавить
            </button>
          </div>
          {form.packageQty && form.packageCost && (
            <div style={{ ...styles.hint, marginTop: -10 }}>
              Цена за 1 {form.unit}: {fmt(Number(form.packageCost) / Number(form.packageQty))} ₽
            </div>
          )}
        </>
      )}

      <Table
        columns={["Услуги", "Препарат", "Страна", "Куплено", "Стоимость партии", "Себестоимость ед.", "Розничная цена ед.", ""]}
        rows={data.materials.map((m) => {
          if (editingId === m.id) {
            return [
              <div style={styles.serviceCheckboxBoxSmall}>
                {data.services.map((s) => (
                  <label key={s.id} style={styles.serviceCheckboxItemSmall}>
                    <input
                      type="checkbox"
                      checked={editForm.serviceIds.includes(s.id)}
                      onChange={() => setEditForm({ ...editForm, serviceIds: toggleServiceId(editForm.serviceIds, s.id) })}
                    />
                    {s.name}
                  </label>
                ))}
              </div>,
              <input style={{ ...styles.input, minWidth: 110 }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />,
              <input style={{ ...styles.input, minWidth: 100 }} value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />,
              <div style={{ display: "flex", gap: 4 }}>
                <input style={{ ...styles.input, maxWidth: 70 }} type="number" value={editForm.packageQty} onChange={(e) => setEditForm({ ...editForm, packageQty: e.target.value })} />
                <select style={{ ...styles.input, maxWidth: 75 }} value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}>
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>,
              <input style={{ ...styles.input, maxWidth: 110 }} type="number" value={editForm.packageCost} onChange={(e) => setEditForm({ ...editForm, packageCost: e.target.value })} />,
              `${fmt(editForm.packageQty && editForm.packageCost ? Number(editForm.packageCost) / Number(editForm.packageQty) : 0)} ₽`,
              <input style={{ ...styles.input, maxWidth: 110 }} type="number" value={editForm.retailPrice} onChange={(e) => setEditForm({ ...editForm, retailPrice: e.target.value })} />,
              <div style={{ display: "flex", gap: 4 }}>
                <button style={styles.iconBtn} onClick={() => saveEdit(m.id)}><Check size={14} /></button>
                <button style={styles.iconBtn} onClick={cancelEdit}><X size={14} /></button>
              </div>,
            ];
          }
          const names = serviceNames(m.serviceIds);
          return [
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {names.length > 0 ? names.map((n) => <AutoColorBadge key={n} text={n} />) : "—"}
            </div>,
            m.name,
            m.country || "—",
            `${fmt(m.packageQty)} ${m.unit}`,
            `${fmt(m.packageCost)} ₽`,
            `${fmt(unitCostOf(m))} ₽ / ${m.unit}`,
            m.retailPrice ? `${fmt(m.retailPrice)} ₽ / ${m.unit}` : "—",
            <div style={{ display: "flex", gap: 4 }}>
              <button style={styles.iconBtn} onClick={() => startEdit(m)}><Pencil size={14} /></button>
              <button style={styles.iconBtn} onClick={() => removeMaterial(m.id)}><Trash2 size={14} /></button>
            </div>,
          ];
        })}
        empty="Пока нет материалов"
      />

      <div style={{ ...styles.card, marginTop: 24 }}>
        <div style={styles.cardTitle}>Аренда кабинета</div>
        <div style={{ ...styles.subtitle, marginBottom: 12 }}>
          Стоимость одного часа аренды — используется в расчёте себестоимости записи
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            style={{ ...styles.input, maxWidth: 160 }}
            type="number"
            value={data.roomHourRate}
            onChange={(e) => update({ roomHourRate: Number(e.target.value) || 0 })}
          />
          <span style={styles.subtitle}>₽ / час</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- FINANCE ---------------- */
function FinanceTab({ data, update, confirm }) {
  const categories = data.expenseCategories && data.expenseCategories.length > 0 ? data.expenseCategories : EXPENSE_CATEGORIES;
  const emptyForm = { date: todayStr(), category: categories[0], amount: "", note: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [newCategory, setNewCategory] = useState("");

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || categories.includes(name)) return;
    update({ expenseCategories: [...categories, name] });
    setForm({ ...form, category: name });
    setNewCategory("");
  };

  const addExpense = () => {
    if (!form.amount) return;
    update({
      expenses: [
        { id: uid(), date: form.date, category: form.category, amount: Number(form.amount), note: form.note },
        ...(data.expenses || []),
      ],
    });
    setForm({ ...emptyForm, date: form.date, category: form.category });
  };

  const removeExpense = (id) => {
    confirm("Удалить этот расход? Это действие нельзя отменить.", () => {
      update({ expenses: (data.expenses || []).filter((e) => e.id !== id) });
    });
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditForm({ date: e.date, category: e.category, amount: e.amount, note: e.note || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = (id) => {
    if (!editForm.amount) return;
    update({
      expenses: (data.expenses || []).map((e) =>
        e.id === id ? { ...e, date: editForm.date, category: editForm.category, amount: Number(editForm.amount), note: editForm.note } : e
      ),
    });
    cancelEdit();
  };

  const expenses = data.expenses || [];
  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const byCategory = {};
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + (Number(e.amount) || 0);
  });

  return (
    <div>
      <SectionTitle title="Финансы" subtitle="Расходы на рекламу, продвижение, сервисы и прочие текущие траты" />

      <div style={styles.formRow}>
        <input
          style={{ ...styles.input, maxWidth: 150 }}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <select style={{ ...styles.input, maxWidth: 170 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          style={{ ...styles.input, maxWidth: 140 }}
          placeholder="Сумма, ₽"
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Комментарий (необязательно)"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <button style={styles.primaryBtn} onClick={addExpense}>
          <Plus size={16} /> Добавить
        </button>
      </div>

      <div style={{ ...styles.formRow, marginTop: -8 }}>
        <input
          style={{ ...styles.input, maxWidth: 220 }}
          placeholder="Новая статья расходов (например «Обучение персонала»)"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button style={styles.smallBtn} onClick={addCategory}>
          <Plus size={13} /> Добавить статью расходов
        </button>
      </div>

      <div style={styles.statsRow}>
        <StatCard label="Всего расходов" value={`${fmt(total)} ₽`} />
        {Object.entries(byCategory).map(([cat, sum]) => (
          <StatCard key={cat} label={cat} value={`${fmt(sum)} ₽`} />
        ))}
      </div>

      <Table
        columns={["Дата", "Категория", "Сумма", "Комментарий", ""]}
        rows={expenses.map((e) => {
          if (editingId === e.id) {
            return [
              <input style={{ ...styles.input, minWidth: 130 }} type="date" value={editForm.date} onChange={(ev) => setEditForm({ ...editForm, date: ev.target.value })} />,
              <select style={{ ...styles.input, minWidth: 140 }} value={editForm.category} onChange={(ev) => setEditForm({ ...editForm, category: ev.target.value })}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>,
              <input style={{ ...styles.input, minWidth: 100 }} type="number" value={editForm.amount} onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })} />,
              <input style={{ ...styles.input, minWidth: 140 }} value={editForm.note} onChange={(ev) => setEditForm({ ...editForm, note: ev.target.value })} />,
              <div style={{ display: "flex", gap: 4 }}>
                <button style={styles.iconBtn} onClick={() => saveEdit(e.id)}><Check size={14} /></button>
                <button style={styles.iconBtn} onClick={cancelEdit}><X size={14} /></button>
              </div>,
            ];
          }
          return [
            e.date,
            <ColorBadge text={e.category} colorMap={EXPENSE_CATEGORY_COLORS} />,
            `${fmt(e.amount)} ₽`,
            e.note || "—",
            <div style={{ display: "flex", gap: 4 }}>
              <button style={styles.iconBtn} onClick={() => startEdit(e)}><Pencil size={14} /></button>
              <button style={styles.iconBtn} onClick={() => removeExpense(e.id)}><Trash2 size={14} /></button>
            </div>,
          ];
        })}
        empty="Расходов пока нет"
      />
    </div>
  );
}

/* ---------------- VISITS ---------------- */
function materialsForService(materials, serviceId) {
  return materials.filter((m) => (m.serviceIds || []).includes(serviceId));
}

// Итоговая розничная сумма по строке материала: если пользователь указал вручную — берём её,
// иначе считаем по умолчанию (цена за ед. × количество)
function materialLineRetailTotal(line, material) {
  if (line.retailTotal !== undefined && line.retailTotal !== null && line.retailTotal !== "") {
    return Number(line.retailTotal) || 0;
  }
  return material ? (Number(material.retailPrice) || 0) * Number(line.qty || 0) : 0;
}

function defaultProcedureLine(data, serviceId) {
  const service = data.services.find((s) => s.id === serviceId);
  const isTraining = service?.type === "Обучение";
  const avail = isTraining ? [] : materialsForService(data.materials, serviceId);
  const firstMaterial = avail[0];
  return {
    id: uid(),
    serviceId,
    price: service?.price || 0,
    materialsUsed: firstMaterial
      ? [{ materialId: firstMaterial.id, qty: 1, retailTotal: Number(firstMaterial.retailPrice) || 0 }]
      : [],
  };
}

function VisitsTab({ data, update, confirm }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(null);
  const [editingVisitId, setEditingVisitId] = useState(null);

  const openForm = () => {
    const serviceId = data.services[0]?.id || "";
    const date = todayStr();
    setEditingVisitId(null);
    setForm({
      id: uid(),
      date,
      time: nowTimeStr(),
      clientId: data.clients[0]?.id || "",
      procedures: serviceId ? [defaultProcedureLine(data, serviceId)] : [],
      roomHours: 1,
      status: date <= todayStr() ? "Выполнено" : "Запланировано",
      notes: "",
    });
    setShowForm(true);
  };

  const startEdit = (v) => {
    setEditingVisitId(v.id);
    const procedures = v.procedures
      ? v.procedures.map((p) => ({ ...p, materialsUsed: p.materialsUsed.map((l) => ({ ...l })) }))
      : [
          {
            id: uid(),
            serviceId: v.serviceId,
            price: data.services.find((s) => s.id === v.serviceId)?.price || 0,
            materialsUsed: (v.materialsUsed || []).map((l) => ({ ...l })),
          },
        ];
    setForm({ status: v.date <= todayStr() ? "Выполнено" : "Запланировано", ...v, procedures });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(null);
    setEditingVisitId(null);
  };

  const saveVisit = () => {
    if (!form.clientId || form.procedures.length === 0) return;
    if (editingVisitId) {
      update({ visits: data.visits.map((v) => (v.id === editingVisitId ? form : v)) });
    } else {
      update({ visits: [form, ...data.visits] });
    }
    closeForm();
  };

  const removeVisit = (id) => {
    confirm("Удалить эту запись? Это действие нельзя отменить.", () => {
      update({ visits: data.visits.filter((v) => v.id !== id) });
    });
  };

  const addProcedure = () => {
    const serviceId = data.services[0]?.id || "";
    if (!serviceId) return;
    setForm({ ...form, procedures: [...form.procedures, defaultProcedureLine(data, serviceId)] });
  };

  const removeProcedure = (idx) => {
    setForm({ ...form, procedures: form.procedures.filter((_, i) => i !== idx) });
  };

  const updateProcedureService = (idx, serviceId) => {
    const procedures = [...form.procedures];
    procedures[idx] = defaultProcedureLine(data, serviceId);
    setForm({ ...form, procedures });
  };

  const updateProcedurePrice = (idx, price) => {
    const procedures = [...form.procedures];
    procedures[idx] = { ...procedures[idx], price };
    setForm({ ...form, procedures });
  };

  const addMaterialLine = (idx) => {
    const p = form.procedures[idx];
    const avail = materialsForService(data.materials, p.serviceId);
    if (avail.length === 0) return;
    const first = avail[0];
    const procedures = [...form.procedures];
    procedures[idx] = {
      ...p,
      materialsUsed: [...p.materialsUsed, { materialId: first.id, qty: 1, retailTotal: Number(first.retailPrice) || 0 }],
    };
    setForm({ ...form, procedures });
  };

  // При смене материала в строке — пересчитываем розничную сумму по умолчанию для нового материала.
  // При смене количества розничную сумму не трогаем — её пользователь мог задать вручную.
  const updateMaterialLine = (pIdx, mIdx, patch) => {
    const procedures = [...form.procedures];
    const lines = [...procedures[pIdx].materialsUsed];
    let next = { ...lines[mIdx], ...patch };
    if (patch.materialId) {
      const m = data.materials.find((mm) => mm.id === patch.materialId);
      next.retailTotal = Number(m?.retailPrice || 0) * Number(next.qty || 0);
    }
    lines[mIdx] = next;
    procedures[pIdx] = { ...procedures[pIdx], materialsUsed: lines };
    setForm({ ...form, procedures });
  };

  const removeMaterialLine = (pIdx, mIdx) => {
    const procedures = [...form.procedures];
    procedures[pIdx] = { ...procedures[pIdx], materialsUsed: procedures[pIdx].materialsUsed.filter((_, i) => i !== mIdx) };
    setForm({ ...form, procedures });
  };

  const calc = (visit) => {
    let servicePriceTotal = 0;
    let serviceCostTotal = 0;
    let materialsRetail = 0;
    let materialsCost = 0;

    (visit.procedures || []).forEach((p) => {
      const service = data.services.find((s) => s.id === p.serviceId);
      servicePriceTotal += Number(p.price) || 0;
      serviceCostTotal += service?.cost || 0;
      p.materialsUsed.forEach((line) => {
        const m = data.materials.find((mm) => mm.id === line.materialId);
        if (!m) return;
        materialsRetail += materialLineRetailTotal(line, m);
        materialsCost += unitCostOf(m) * Number(line.qty || 0);
      });
    });

    const roomCost = Number(visit.roomHours || 0) * (data.roomHourRate || 0);
    const revenue = servicePriceTotal + materialsRetail;
    const totalCost = serviceCostTotal + materialsCost + roomCost;
    return {
      revenue,
      servicePriceTotal,
      materialsRetail,
      serviceCostTotal,
      materialsCost,
      roomCost,
      totalCost,
      profit: revenue - totalCost,
    };
  };

  const canBuild = data.clients.length > 0 && data.services.length > 0;

  return (
    <div>
      <SectionTitle title="Записи" subtitle="Одна запись может включать несколько процедур, материалы и аренду" />

      {!canBuild && (
        <div style={styles.hint}>
          Сначала добавьте хотя бы одного клиента и одну услугу — во вкладках «Клиенты» и «Услуги».
        </div>
      )}

      {canBuild && !showForm && (
        <button style={styles.primaryBtn} onClick={openForm}>
          <Plus size={16} /> Новая запись
        </button>
      )}

      {showForm && form && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={styles.cardTitle}>{editingVisitId ? "Редактирование записи" : "Новая запись"}</div>
            <button style={styles.iconBtn} onClick={closeForm}>
              <X size={16} />
            </button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Дата
              <input
                style={styles.input}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>

            <label style={styles.label}>
              Время
              <select style={styles.input} value={form.time || ""} onChange={(e) => setForm({ ...form, time: e.target.value })}>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Клиент
              <select
                style={styles.input}
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              >
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Часы аренды кабинета
              <input
                style={styles.input}
                type="number"
                min="0"
                step="0.5"
                value={form.roomHours}
                onChange={(e) => setForm({ ...form, roomHours: e.target.value })}
              />
            </label>

            <label style={styles.label}>
              Статус
              <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {VISIT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          {form.status === "Запланировано" && (
            <div style={{ ...styles.hint, marginTop: 10 }}>
              Это запланированная запись на будущее — деньги ещё не в кассе, учитывается только в прогнозируемой прибыли
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={styles.subtitle}>Процедуры в записи</div>
              <button style={styles.smallBtn} onClick={addProcedure}>
                <Plus size={13} /> Ещё процедура
              </button>
            </div>

            {form.procedures.map((p, pIdx) => {
              const service = data.services.find((s) => s.id === p.serviceId);
              const isTraining = service?.type === "Обучение";
              const availableMaterials = materialsForService(data.materials, p.serviceId);
              return (
                <div key={p.id} style={styles.procedureBlock}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label style={{ ...styles.label, flex: 2, minWidth: 160 }}>
                      Процедура
                      <select
                        style={styles.input}
                        value={p.serviceId}
                        onChange={(e) => updateProcedureService(pIdx, e.target.value)}
                      >
                        {data.services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.type || "Процедуры"}) — рек. {fmt(s.price)} ₽
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ ...styles.label, maxWidth: 130 }}>
                      Цена, ₽
                      <input
                        style={styles.input}
                        type="number"
                        value={p.price}
                        onChange={(e) => updateProcedurePrice(pIdx, Number(e.target.value) || 0)}
                      />
                    </label>
                    {form.procedures.length > 1 && (
                      <button style={styles.iconBtn} onClick={() => removeProcedure(pIdx)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {isTraining ? (
                    <div style={{ ...styles.hint, marginTop: 10, marginBottom: 0 }}>
                      Тип «Обучение» — материалы не учитываются, только аренда кабинета
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ ...styles.subtitle, fontSize: 12 }}>Материалы для этой процедуры</div>
                        <button style={styles.smallBtn} onClick={() => addMaterialLine(pIdx)} disabled={availableMaterials.length === 0}>
                          <Plus size={12} /> Материал
                        </button>
                      </div>
                      {p.materialsUsed.length === 0 && (
                        <div style={{ ...styles.hint, marginTop: 8 }}>
                          {availableMaterials.length === 0
                            ? "Для этой процедуры пока не привязано ни одного материала"
                            : "Материалы не добавлены"}
                        </div>
                      )}
                      {p.materialsUsed.map((line, mIdx) => {
                        const material = data.materials.find((m) => m.id === line.materialId);
                        return (
                          <div key={mIdx} style={styles.materialLineWrap}>
                            <div style={styles.materialLine}>
                              <select
                                style={styles.input}
                                value={line.materialId}
                                onChange={(e) => updateMaterialLine(pIdx, mIdx, { materialId: e.target.value })}
                              >
                                {availableMaterials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} (себест. {fmt(unitCostOf(m))} ₽ / РРЦ {fmt(m.retailPrice || 0)} ₽ за {m.unit})
                                  </option>
                                ))}
                              </select>
                              <input
                                style={{ ...styles.input, maxWidth: 80 }}
                                type="number"
                                min="0"
                                value={line.qty}
                                onChange={(e) => updateMaterialLine(pIdx, mIdx, { qty: e.target.value })}
                              />
                              <button style={styles.iconBtn} onClick={() => removeMaterialLine(pIdx, mIdx)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div style={styles.materialLineRetailRow}>
                              <span style={styles.materialRrpLabel}>
                                РРЦ: {fmt(material?.retailPrice || 0)} ₽/{material?.unit || "ед"}
                              </span>
                              <label style={styles.materialRetailTotalLabel}>
                                Итого розница, ₽
                                <input
                                  style={{ ...styles.input, maxWidth: 110 }}
                                  type="number"
                                  min="0"
                                  value={line.retailTotal ?? ""}
                                  onChange={(e) => updateMaterialLine(pIdx, mIdx, { retailTotal: e.target.value })}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <label style={{ ...styles.label, marginTop: 14 }}>
            Комментарий (необязательно)
            <input
              style={styles.input}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>

          <VisitPreview calc={calc(form)} />

          <button style={{ ...styles.primaryBtn, marginTop: 14 }} onClick={saveVisit}>
            <Save size={16} /> {editingVisitId ? "Сохранить изменения" : "Сохранить запись"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Table
          columns={["Дата и время", "Статус", "Клиент", "Процедуры", "Выручка", "Себестоимость", "Прибыль", "Комментарий", ""]}
          rows={[...data.visits]
            .sort((a, b) => {
              const aKey = `${a.date || ""} ${a.time || "00:00"}`;
              const bKey = `${b.date || ""} ${b.time || "00:00"}`;
              return aKey < bKey ? 1 : -1;
            })
            .map((v) => {
              const c = calc(v);
              const client = data.clients.find((x) => x.id === v.clientId);
              const procedures = v.procedures || (v.serviceId ? [{ serviceId: v.serviceId }] : []);
              const status = v.status || (v.date <= todayStr() ? "Выполнено" : "Запланировано");
              return [
                `${v.date}${v.time ? ", " + v.time : ""}`,
                <ColorBadge text={status} colorMap={VISIT_STATUS_COLORS} />,
                client?.name || "—",
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {procedures.map((p, i) => {
                    const service = data.services.find((s) => s.id === p.serviceId);
                    return <AutoColorBadge key={i} text={service?.name || "—"} />;
                  })}
                </div>,
                `${fmt(c.revenue)} ₽`,
                `${fmt(c.totalCost)} ₽`,
                <span style={{ color: c.profit >= 0 ? "#2f6b4f" : "#a13d3d", fontWeight: 600 }}>
                  {fmt(c.profit)} ₽
                </span>,
                v.notes ? v.notes : <span style={{ color: palette.subtext }}>без комментария</span>,
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={styles.iconBtn} onClick={() => startEdit(v)}>
                    <Pencil size={14} />
                  </button>
                  <button style={styles.iconBtn} onClick={() => removeVisit(v.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>,
              ];
            })}
          empty="Записей пока нет"
        />
      </div>
    </div>
  );
}

function VisitPreview({ calc }) {
  return (
    <div style={styles.previewBox}>
      <PreviewLine label="Услуги (цена)" value={calc.servicePriceTotal} />
      <PreviewLine label="Материалы (розница)" value={calc.materialsRetail} />
      <div style={styles.previewDivider} />
      <PreviewLine label="Себестоимость услуг" value={-calc.serviceCostTotal} sign />
      <PreviewLine label="Себестоимость материалов" value={-calc.materialsCost} sign />
      <PreviewLine label="Аренда кабинета" value={-calc.roomCost} sign />
      <div style={styles.previewDivider} />
      <PreviewLine label="Прибыль" value={calc.profit} bold />
    </div>
  );
}

function PreviewLine({ label, value, bold, sign }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ color: "#6b5f5a", fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: bold ? (value >= 0 ? "#2f6b4f" : "#a13d3d") : "#3a322f" }}>
        {sign && value !== 0 ? "-" : ""}
        {fmt(Math.abs(value))} ₽
      </span>
    </div>
  );
}

/* ---------------- CALENDAR ---------------- */
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_LABELS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function CalendarTab({ data }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const { year, month } = cursor;
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const visitsByDate = {};
  data.visits.forEach((v) => {
    if (!v.date) return;
    visitsByDate[v.date] = visitsByDate[v.date] || [];
    visitsByDate[v.date].push(v);
  });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrevMonth = () => {
    setCursor(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  };
  const goNextMonth = () => {
    setCursor(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  };

  const selectedVisits = (visitsByDate[selectedDate] || [])
    .slice()
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const todayKey = todayStr();

  return (
    <div>
      <SectionTitle title="Календарь" subtitle="Загруженность по записям — считается автоматически из вкладки «Записи»" />

      <div style={styles.calHeader}>
        <button style={styles.iconBtn} onClick={goPrevMonth}>
          <ChevronLeft size={16} />
        </button>
        <div style={styles.calMonthTitle}>
          {MONTH_LABELS[month]} {year}
        </div>
        <button style={styles.iconBtn} onClick={goNextMonth}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={styles.calWeekRow}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={styles.calWeekLabel}>
            {w}
          </div>
        ))}
      </div>

      <div style={styles.calGrid}>
        {cells.map((d, idx) => {
          if (d === null) return <div key={idx} style={styles.calCellEmpty} />;
          const key = dateKey(year, month, d);
          const dayVisits = visitsByDate[key] || [];
          const isSelected = key === selectedDate;
          const isToday = key === todayKey;
          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(key)}
              style={{
                ...styles.calCell,
                ...(isSelected ? styles.calCellSelected : {}),
                ...(isToday && !isSelected ? styles.calCellToday : {}),
              }}
            >
              <span>{d}</span>
              {dayVisits.length > 0 && (
                <span style={styles.calDayBadge}>{dayVisits.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={styles.cardTitle}>
          {selectedDate} — {selectedVisits.length === 0 ? "записей нет" : `записей: ${selectedVisits.length}`}
        </div>
        {selectedVisits.length === 0 ? (
          <div style={{ ...styles.hint, marginTop: 10 }}>На этот день пока ничего не запланировано</div>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedVisits.map((v) => {
              const client = data.clients.find((c) => c.id === v.clientId);
              const procedures = v.procedures || (v.serviceId ? [{ serviceId: v.serviceId }] : []);
              return (
                <div key={v.id} style={styles.calAgendaRow}>
                  <div style={styles.calAgendaTime}>{v.time || "—:—"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{client?.name || "—"}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                      {procedures.map((p, i) => {
                        const service = data.services.find((s) => s.id === p.serviceId);
                        return <AutoColorBadge key={i} text={service?.name || "—"} />;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
function DashboardTab({ data }) {
  const calcVisit = (v) => {
    const procedures = v.procedures || (v.serviceId ? [{ serviceId: v.serviceId, price: undefined, materialsUsed: v.materialsUsed || [] }] : []);
    let servicePriceTotal = 0;
    let serviceCostTotal = 0;
    let materialsRetail = 0;
    let materialsCost = 0;

    procedures.forEach((p) => {
      const service = data.services.find((s) => s.id === p.serviceId);
      servicePriceTotal += p.price != null ? Number(p.price) : (service?.price || 0);
      serviceCostTotal += service?.cost || 0;
      (p.materialsUsed || []).forEach((line) => {
        const m = data.materials.find((mm) => mm.id === line.materialId);
        if (!m) return;
        materialsRetail += materialLineRetailTotal(line, m);
        materialsCost += unitCostOf(m) * Number(line.qty || 0);
      });
    });

    const roomCost = Number(v.roomHours || 0) * (data.roomHourRate || 0);
    const revenue = servicePriceTotal + materialsRetail;
    const cost = serviceCostTotal + materialsCost + roomCost;
    return { revenue, cost, profit: revenue - cost, procedures, servicePriceTotal, materialsRetail, serviceCostTotal, materialsCost, roomCost };
  };

  const isCompleted = (v) => (v.status || (v.date <= todayStr() ? "Выполнено" : "Запланировано")) === "Выполнено";

  const emptyBreakdown = {
    count: 0, servicePriceTotal: 0, materialsRetail: 0, serviceCostTotal: 0, materialsCost: 0, roomCost: 0, revenue: 0, cost: 0, profit: 0,
  };

  const totals = data.visits.reduce(
    (acc, v) => {
      const c = calcVisit(v);
      acc.all.count += 1;
      acc.all.servicePriceTotal += c.servicePriceTotal;
      acc.all.materialsRetail += c.materialsRetail;
      acc.all.serviceCostTotal += c.serviceCostTotal;
      acc.all.materialsCost += c.materialsCost;
      acc.all.roomCost += c.roomCost;
      acc.all.revenue += c.revenue;
      acc.all.cost += c.cost;
      acc.all.profit += c.profit;
      if (isCompleted(v)) {
        acc.actual.count += 1;
        acc.actual.servicePriceTotal += c.servicePriceTotal;
        acc.actual.materialsRetail += c.materialsRetail;
        acc.actual.serviceCostTotal += c.serviceCostTotal;
        acc.actual.materialsCost += c.materialsCost;
        acc.actual.roomCost += c.roomCost;
        acc.actual.revenue += c.revenue;
        acc.actual.cost += c.cost;
        acc.actual.profit += c.profit;
      }
      return acc;
    },
    { all: { ...emptyBreakdown }, actual: { ...emptyBreakdown } }
  );

  const expensesTotal = (data.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const actualNetProfit = totals.actual.profit - expensesTotal;
  const projectedNetProfit = totals.all.profit - expensesTotal;

  const [breakdownOpen, setBreakdownOpen] = useState(null); // "actual" | "projected" | null

  const bySource = {};
  data.visits.forEach((v) => {
    const client = data.clients.find((c) => c.id === v.clientId);
    const src = client?.source || "Не указан";
    const c = calcVisit(v);
    bySource[src] = bySource[src] || { count: 0, revenue: 0 };
    bySource[src].count += 1;
    bySource[src].revenue += c.revenue;
  });

  const byService = {};
  data.visits.forEach((v) => {
    const c = calcVisit(v);
    const nProc = c.procedures.length || 1;
    c.procedures.forEach((p) => {
      const service = data.services.find((s) => s.id === p.serviceId);
      const name = service?.name || "Не указана";
      byService[name] = byService[name] || { count: 0, revenue: 0, profit: 0 };
      byService[name].count += 1;
      byService[name].revenue += c.revenue / nProc;
      byService[name].profit += c.profit / nProc;
    });
  });

  return (
    <div>
      <SectionTitle title="Дашборд" subtitle="Фактическая — по уже выполненным записям. Прогнозируемая — с учётом запланированных на будущее" />

      <div style={styles.profitHeroRow}>
        <div style={styles.profitHero}>
          <div style={styles.profitHeroTop}>
            <div style={styles.profitHeroLabel}>Фактическая прибыль</div>
            <button style={styles.profitHeroMagnifier} onClick={() => setBreakdownOpen("actual")} title="Из чего складывается">
              <Search size={16} />
            </button>
          </div>
          <div style={styles.profitHeroValue}>{fmt(actualNetProfit)} ₽</div>
        </div>
        <div style={{ ...styles.profitHero, ...styles.profitHeroProjected }}>
          <div style={styles.profitHeroTop}>
            <div style={styles.profitHeroLabel}>Прогнозируемая прибыль</div>
            <button style={styles.profitHeroMagnifier} onClick={() => setBreakdownOpen("projected")} title="Из чего складывается">
              <Search size={16} />
            </button>
          </div>
          <div style={styles.profitHeroValue}>{fmt(projectedNetProfit)} ₽</div>
        </div>
      </div>

      {breakdownOpen && (
        <ProfitBreakdownModal
          title={breakdownOpen === "actual" ? "Из чего складывается фактическая прибыль" : "Из чего складывается прогнозируемая прибыль"}
          data={breakdownOpen === "actual" ? totals.actual : totals.all}
          expensesTotal={expensesTotal}
          netProfit={breakdownOpen === "actual" ? actualNetProfit : projectedNetProfit}
          note={
            breakdownOpen === "actual"
              ? "Учтены только записи со статусом «Выполнено»"
              : `Учтены все записи: выполненных — ${totals.actual.count}, запланированных — ${totals.all.count - totals.actual.count}`
          }
          onClose={() => setBreakdownOpen(null)}
        />
      )}

      <div style={styles.statsRow}>
        <StatCard label="Клиентов" value={data.clients.length} />
        <StatCard label="Записей всего" value={data.visits.length} />
        <StatCard label="Выручка (факт)" value={`${fmt(totals.actual.revenue)} ₽`} />
        <StatCard label="Выручка (прогноз)" value={`${fmt(totals.all.revenue)} ₽`} />
        <StatCard label="Себестоимость (факт)" value={`${fmt(totals.actual.cost)} ₽`} />
        <StatCard label="Общие расходы" value={`${fmt(expensesTotal)} ₽`} />
      </div>

      <div style={styles.dashGrid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>По источнику клиентов</div>
          <Table
            columns={["Источник", "Клиентов пришло", "Выручка"]}
            rows={Object.entries(bySource).map(([src, v]) => [
              <ColorBadge text={src} colorMap={SOURCE_COLORS} />,
              v.count,
              `${fmt(v.revenue)} ₽`,
            ])}
            empty="Нет данных"
            compact
          />
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>По процедурам</div>
          <Table
            columns={["Процедура", "Кол-во", "Выручка", "Прибыль"]}
            rows={Object.entries(byService).map(([name, v]) => [
              <AutoColorBadge text={name} />,
              v.count,
              `${fmt(v.revenue)} ₽`,
              `${fmt(v.profit)} ₽`,
            ])}
            empty="Нет данных"
            compact
          />
        </div>
      </div>
    </div>
  );
}

function ProfitBreakdownModal({ title, data, expensesTotal, netProfit, note, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalBox, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={styles.cardTitle}>{title}</div>
          <button style={styles.iconBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ ...styles.subtitle, marginTop: 4, marginBottom: 10 }}>{note}</div>
        <div style={styles.previewBox}>
          <PreviewLine label="Услуги (цена)" value={data.servicePriceTotal} />
          <PreviewLine label="Материалы (розница)" value={data.materialsRetail} />
          <div style={styles.previewDivider} />
          <PreviewLine label="Себестоимость услуг" value={-data.serviceCostTotal} sign />
          <PreviewLine label="Себестоимость материалов" value={-data.materialsCost} sign />
          <PreviewLine label="Аренда кабинета" value={-data.roomCost} sign />
          <PreviewLine label="Общие расходы (Финансы)" value={-expensesTotal} sign />
          <div style={styles.previewDivider} />
          <PreviewLine label="Итого прибыль" value={netProfit} bold />
        </div>
        <div style={{ ...styles.hint, marginTop: 12, marginBottom: 0 }}>
          Учтено записей: {data.count}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div style={{ ...styles.statCard, ...(highlight ? styles.statCardHighlight : {}) }}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

/* ---------------- SHARED UI ---------------- */
function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={styles.h2}>{title}</h2>
      {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}

function Table({ columns, rows, empty, compact }) {
  if (rows.length === 0) {
    return <div style={styles.emptyBox}>{empty}</div>;
  }
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ ...styles.th, ...(compact ? { padding: "6px 10px" } : {}) }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={styles.tr}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ ...styles.td, ...(compact ? { padding: "6px 10px" } : {}) }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const palette = {
  bg: "#FBF6F3",
  card: "#FFFFFF",
  border: "#EBDFD9",
  text: "#3A302B",
  subtext: "#8A7A72",
  accent: "#B5697A",
  accentDark: "#8F4A5A",
  accentSoft: "#F3E3E6",
};

const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  input:focus, select:focus { outline: 2px solid ${palette.accent}44; border-color: ${palette.accent} !important; }
  button { cursor: pointer; font-family: inherit; }
  table { border-collapse: collapse; width: 100%; }
`;

const styles = {
  app: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    background: palette.bg,
    minHeight: "100vh",
    color: palette.text,
    padding: "0 0 40px 0",
  },
  loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: 300 },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(58, 48, 43, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modalBox: {
    background: "#fff",
    borderRadius: 14,
    padding: "22px 24px",
    maxWidth: 360,
    width: "100%",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  modalMessage: { fontSize: 14.5, color: palette.text, lineHeight: 1.4 },
  loadingText: { color: palette.subtext, fontSize: 14 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: "28px 28px 18px 28px",
    borderBottom: `1px solid ${palette.border}`,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: palette.accent,
    fontWeight: 700,
    marginBottom: 4,
  },
  h1: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 26,
    margin: 0,
    color: palette.text,
    fontWeight: 600,
  },
  h2: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 20,
    margin: 0,
    fontWeight: 600,
  },
  saveIndicator: { fontSize: 12, color: palette.subtext, minWidth: 100, textAlign: "right" },
  nav: {
    display: "flex",
    gap: 4,
    padding: "14px 28px 0 28px",
    flexWrap: "wrap",
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    border: "none",
    background: "transparent",
    color: palette.subtext,
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 500,
  },
  navBtnActive: {
    background: palette.accentSoft,
    color: palette.accentDark,
    fontWeight: 700,
  },
  main: { padding: "24px 28px" },
  subtitle: { fontSize: 13, color: palette.subtext },
  formRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 18,
    alignItems: "center",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 12,
  },
  formGridStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontSize: 12.5,
    color: palette.subtext,
    fontWeight: 600,
  },
  input: {
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: "9px 11px",
    fontSize: 13.5,
    background: "#fff",
    color: palette.text,
    minWidth: 140,
    flex: "1 1 auto",
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: palette.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13.5,
    fontWeight: 700,
  },
  smallBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: palette.accentSoft,
    color: palette.accentDark,
    border: "none",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 12.5,
    fontWeight: 700,
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    color: palette.subtext,
    padding: 6,
    borderRadius: 6,
  },
  badge: {
    background: palette.accentSoft,
    color: palette.accentDark,
    padding: "3px 9px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  serviceCheckboxBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 14px",
    alignItems: "center",
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    background: "#fff",
    width: "100%",
  },
  serviceCheckboxLabel: { fontSize: 12, fontWeight: 700, color: palette.subtext },
  serviceCheckboxItem: { display: "flex", alignItems: "center", gap: 5, fontSize: 13 },
  serviceCheckboxBoxSmall: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    maxHeight: 90,
    overflowY: "auto",
    minWidth: 130,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    padding: "4px 8px",
  },
  serviceCheckboxItemSmall: { display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, whiteSpace: "nowrap" },
  procedureBlock: {
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    background: "#FDFBFA",
  },
  tableWrap: {
    background: palette.card,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    overflowX: "auto",
    overflowY: "hidden",
    maxWidth: "100%",
  },
  table: { fontSize: 13.5, minWidth: 600 },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    background: "#FAF3F1",
    color: palette.subtext,
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    borderBottom: `1px solid ${palette.border}`,
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: `1px solid ${palette.border}` },
  td: { padding: "10px 14px", verticalAlign: "middle" },
  emptyBox: {
    padding: "28px 16px",
    textAlign: "center",
    color: palette.subtext,
    background: palette.card,
    border: `1px dashed ${palette.border}`,
    borderRadius: 12,
    fontSize: 13.5,
  },
  hint: {
    background: palette.accentSoft,
    color: palette.accentDark,
    padding: "12px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  card: {
    background: palette.card,
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    padding: 20,
  },
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  materialLine: {
    display: "flex",
    gap: 8,
    marginTop: 8,
    alignItems: "center",
  },
  materialLineWrap: {
    borderBottom: `1px dashed ${palette.border}`,
    paddingBottom: 8,
    marginBottom: 4,
  },
  materialLineRetailRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap",
  },
  materialRrpLabel: { fontSize: 11.5, color: palette.subtext },
  materialRetailTotalLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11.5,
    color: palette.subtext,
    fontWeight: 600,
  },
  previewBox: {
    marginTop: 16,
    background: "#FAF3F1",
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    padding: "12px 16px",
  },
  previewDivider: { height: 1, background: palette.border, margin: "6px 0" },
  calHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
  },
  calMonthTitle: {
    fontFamily: "Georgia, serif",
    fontSize: 15,
    fontWeight: 700,
    minWidth: 130,
    textAlign: "center",
  },
  calWeekRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    marginBottom: 2,
    maxWidth: 380,
    margin: "0 auto",
  },
  calWeekLabel: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
    color: palette.subtext,
    textTransform: "uppercase",
    padding: "2px 0",
  },
  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 3,
    maxWidth: 380,
    margin: "0 auto",
  },
  calCellEmpty: { visibility: "hidden" },
  calCell: {
    position: "relative",
    height: 34,
    border: `1px solid ${palette.border}`,
    borderRadius: 7,
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    color: palette.text,
  },
  calCellSelected: {
    background: palette.accent,
    color: "#fff",
    borderColor: palette.accent,
  },
  calCellToday: {
    borderColor: palette.accent,
    borderWidth: 2,
  },
  calDayBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    background: "#1F8F4E",
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    borderRadius: 8,
    padding: "0px 4px",
    lineHeight: 1.4,
  },
  calAgendaRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: `1px solid ${palette.border}`,
  },
  calAgendaTime: {
    fontWeight: 700,
    fontFamily: "Georgia, serif",
    fontSize: 15,
    minWidth: 54,
  },
  profitHeroRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  profitHero: {
    background: "linear-gradient(135deg, #1F8F4E, #2FAE63)",
    borderRadius: 16,
    padding: "22px 26px",
    color: "#fff",
    flex: "1 1 220px",
  },
  profitHeroProjected: {
    background: "linear-gradient(135deg, #4A6FA5, #6E93C8)",
  },
  profitHeroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profitHeroMagnifier: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.2)",
    border: "none",
    borderRadius: 8,
    padding: 6,
    color: "#fff",
  },
  profitHeroLabel: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.9,
  },
  profitHeroValue: {
    fontFamily: "Georgia, serif",
    fontSize: 40,
    fontWeight: 700,
    marginTop: 4,
  },
  statsRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  statCard: {
    background: palette.card,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    padding: "16px 20px",
    minWidth: 140,
    flex: "1 1 140px",
  },
  statCardHighlight: {
    background: palette.accentSoft,
    borderColor: palette.accent,
  },
  statValue: { fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif" },
  statLabel: { fontSize: 12, color: palette.subtext, marginTop: 4 },
  dashGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
};
