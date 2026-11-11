import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Apple, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, ClipboardList, Droplets, Dumbbell, Heart, Home,
  Plus, Trash2, X, Clock3, Target, Menu, Utensils, Scale
} from "lucide-react";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const initialData = {
  weights: [],
  waterEntries: [],
  waterGoal: 2000,
  weightGoal: "",
  tasks: [],
  events: [],
  workouts: [],
  meals: []
};
const navItems = [
  ["home", "Início", Home],
  ["health", "Saúde e peso", Heart],
  ["calendar", "Calendário", CalendarDays],
  ["routine", "Minha rotina", ClipboardList],
  ["events", "Compromissos", Clock3],
  ["workouts", "Treinos", Dumbbell],
  ["food", "Alimentação", Apple]
];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekDaysLong = ["Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado","Domingo"];
const mealsTypes = ["Café da manhã","Lanche da manhã","Almoço","Lanche da tarde","Jantar","Ceia"];

function loadData() {
  try {
    const saved = localStorage.getItem("my-routine-data");
    return saved ? { ...initialData, ...JSON.parse(saved) } : initialData;
  } catch {
    return initialData;
  }
}
function dateLabel(value) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric"
  });
}
function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
function Card({ title, icon: Icon, children, className = "" }) {
  return <section className={`card ${className}`}>
    <div className="card-heading"><h3>{title}</h3>{Icon && <Icon size={19} />}</div>
    {children}
  </section>;
}
function Empty({ children = "Nada por aqui ainda. Adicione seu primeiro registro!" }) {
  return <p className="empty-state">{children}</p>;
}
function Progress({ value }) {
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState("home");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [month, setMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [mobileMenu, setMobileMenu] = useState(false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleStatus, setGoogleStatus] = useState("disconnected");
  const [googleMessage, setGoogleMessage] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const tokenClientRef = useRef(null);
  const googleTokenRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [weightInput, setWeightInput] = useState("");
  const [waterInput, setWaterInput] = useState("250");
  const [taskInput, setTaskInput] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [workoutDay, setWorkoutDay] = useState(weekDaysLong[0]);
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("12");
  const [load, setLoad] = useState("");
  const [mealType, setMealType] = useState(mealsTypes[0]);
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");

  useEffect(() => {
    if (!googleClientId) {
      setGoogleStatus("missing-config");
      setGoogleMessage(
        "Configure VITE_GOOGLE_CLIENT_ID no arquivo .env para conectar o Google Agenda."
      );
      return;
    }

    let cancelled = false;

    const initializeGoogle = () => {
      if (cancelled || !window.google?.accounts?.oauth2) return false;

      tokenClientRef.current =
        window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "https://www.googleapis.com/auth/calendar.readonly",
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setGoogleStatus("error");
              setGoogleMessage(
                tokenResponse.error === "access_denied"
                  ? "A autorização foi cancelada. Você pode tentar novamente."
                  : "O Google não autorizou o acesso. Confira a configuração OAuth."
              );
              return;
            }

            try {
              const accessToken = tokenResponse.access_token;
              googleTokenRef.current = accessToken;

              const now = new Date();
              const later = new Date();
              later.setDate(later.getDate() + 45);

              const params = new URLSearchParams({
                timeMin: now.toISOString(),
                timeMax: later.toISOString(),
                showDeleted: "false",
                singleEvents: "true",
                orderBy: "startTime",
                maxResults: "100"
              });

              const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`
                  }
                }
              );

              if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(
                  errorBody.error?.message || `Google Calendar HTTP ${response.status}`
                );
              }

              const result = await response.json();
              const items = (result.items || []).map(event => ({
                id: event.id,
                title: event.summary || "Sem título",
                date: (event.start?.dateTime || event.start?.date || "").slice(0, 10),
                time: event.start?.dateTime
                  ? new Date(event.start.dateTime).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "Dia inteiro",
                source: "google",
                htmlLink: event.htmlLink
              }));

              setGoogleEvents(items);
              setGoogleStatus("connected");
              setGoogleMessage(
                `Calendário conectado! ${items.length} evento(s) encontrados nos próximos 45 dias.`
              );
            } catch (error) {
              console.error("Google Calendar:", error);
              setGoogleStatus("error");
              setGoogleMessage(
                error.message || "Não foi possível carregar os eventos do Google Agenda."
              );
            }
          }
        });

      setGoogleReady(true);
      setGoogleStatus("disconnected");
      setGoogleMessage("");
      return true;
    };

    if (initializeGoogle()) {
      return () => {
        cancelled = true;
      };
    }

    let script = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    const handleLoad = () => {
      if (!initializeGoogle() && !cancelled) {
        setGoogleStatus("error");
        setGoogleMessage(
          "O serviço do Google carregou, mas não ficou disponível. Atualize a página e tente novamente."
        );
      }
    };

    const handleError = () => {
      if (!cancelled) {
        setGoogleStatus("error");
        setGoogleMessage(
          "Não foi possível carregar o serviço de autenticação do Google. Confira sua conexão."
        );
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });

      if (script.readyState === "complete" || window.google?.accounts?.oauth2) {
        handleLoad();
      }
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, [googleClientId]);

  useEffect(() => {
    localStorage.setItem("my-routine-data", JSON.stringify(data));
  }, [data]);

  const update = (key, value) => setData(current => ({ ...current, [key]: value }));
  const add = (key, item) => update(key, [...data[key], { id: uid(), ...item }]);
  const remove = (key, id) => update(key, data[key].filter(item => item.id !== id));

  const currentWeight = data.weights.length ? data.weights[data.weights.length - 1].value : null;
  const waterToday = data.waterEntries.filter(item => item.date === todayISO()).reduce((sum, item) => sum + item.amount, 0);
  const todayTasks = data.tasks.filter(item => item.date === todayISO());
  const completedTasks = todayTasks.filter(item => item.done).length;
  const title = navItems.find(item => item[0] === page)?.[1] ?? "Início";

  const selectedTasks = data.tasks.filter(item => item.date === selectedDate);
  const selectedEvents = data.events.filter(item => item.date === selectedDate);
  const selectedMeals = data.meals.filter(item => item.date === selectedDate);

  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = first.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);

  function addTask(e) {
    e.preventDefault();
    if (!taskInput.trim()) return;
    add("tasks", { title: taskInput.trim(), time: taskTime, date: selectedDate, done: false });
    setTaskInput(""); setTaskTime("");
  }
  function addWeight(e) {
    e.preventDefault();
    const value = Number(weightInput);
    if (!value || value <= 0) return;
    add("weights", { value, date: todayISO() });
    setWeightInput("");
  }
  function addWater(amount) {
    if (!amount || amount <= 0) return;
    add("waterEntries", { amount, date: todayISO(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
  }
  function addEvent(e) {
    e.preventDefault();
    if (!eventName.trim()) return;
    add("events", { title: eventName.trim(), time: eventTime, date: selectedDate });
    setEventName(""); setEventTime("");
  }
  function addWorkout(e) {
    e.preventDefault();
    if (!exercise.trim()) return;
    add("workouts", { day: workoutDay, name: exercise.trim(), sets: Number(sets) || 0, reps: Number(reps) || 0, load: Number(load) || 0 });
    setExercise(""); setLoad("");
  }
  function addMeal(e) {
    e.preventDefault();
    if (!foodName.trim()) return;
    add("meals", { type: mealType, name: foodName.trim(), calories: Number(calories) || 0, date: selectedDate });
    setFoodName(""); setCalories("");
  }
  function toggleTask(id) {
    update("tasks", data.tasks.map(item => item.id === id ? { ...item, done: !item.done } : item));
  }
  function setDateFromCalendar(day) {
    if (!day) return;
    setSelectedDate(`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
  }

  function connectGoogleCalendar() {
    if (!googleClientId) {
      setGoogleStatus("missing-config");
      setGoogleMessage(
        "Configure VITE_GOOGLE_CLIENT_ID no arquivo .env e faça um novo deploy."
      );
      return;
    }

    if (!googleReady || !tokenClientRef.current) {
      setGoogleStatus("error");
      setGoogleMessage(
        "O Google ainda está carregando. Aguarde alguns segundos e tente novamente."
      );
      return;
    }

    setGoogleStatus("connecting");
    setGoogleMessage("Aguardando autorização do Google…");

    try {
      // Solicita o token diretamente no clique do usuário.
      tokenClientRef.current.requestAccessToken({ prompt: "consent" });
    } catch (error) {
      console.error("Google OAuth:", error);
      setGoogleStatus("error");
      setGoogleMessage(
        "Não foi possível abrir a autorização. Verifique se pop-ups estão permitidos e tente novamente."
      );
    }
  }

  function disconnectGoogleCalendar() {
    const token = googleTokenRef.current;

    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }

    googleTokenRef.current = null;
    setGoogleEvents([]);
    setGoogleStatus("disconnected");
    setGoogleMessage("Google Agenda desconectado.");
  }

  const pageContent = () => {
    if (page === "home") return <>
      <section className="welcome">
        <div><span className="eyebrow">SEU NOVO COMEÇO ✨</span><h2>Pequenos passos,<br />grandes conquistas.</h2><p>Cuide de você e acompanhe sua evolução, um dia de cada vez.</p></div>
        <div className="welcome-art">✿</div>
      </section>
      <div className="stats-grid">
        <Card title="Peso atual" icon={Scale}><div className="stat-value">{currentWeight ? `${currentWeight} kg` : "—"}</div><p className="muted">Última pesagem registrada</p></Card>
        <Card title="Água hoje" icon={Droplets}><div className="stat-value">{waterToday.toLocaleString("pt-BR")} <small>ml</small></div><Progress value={waterToday / (Number(data.waterGoal) || 2000) * 100} /><p className="muted">Meta: {Number(data.waterGoal).toLocaleString("pt-BR")} ml</p></Card>
        <Card title="Tarefas concluídas" icon={CheckCircle2}><div className="stat-value">{completedTasks}/{todayTasks.length}</div><p className="muted">Atividades de hoje</p></Card>
      </div>
      <div className="content-grid">
        <Card title="Minha rotina de hoje" icon={ClipboardList}>
          {todayTasks.length ? <div className="item-list">{todayTasks.map(task => <TaskRow key={task.id} item={task} onToggle={() => toggleTask(task.id)} onDelete={() => remove("tasks", task.id)} />)}</div> : <Empty>Você ainda não adicionou tarefas para hoje.</Empty>}
          <button className="link-button" onClick={() => setPage("routine")}>Organizar minha rotina <ChevronRight size={15}/></button>
        </Card>
        <Card title="Próximos compromissos" icon={Clock3}>
          {data.events.filter(event => event.date >= todayISO()).sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0,4).length ?
            data.events.filter(event => event.date >= todayISO()).sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0,4).map(event => <div className="event-row" key={event.id}><div className="event-dot"/><div><b>{event.title}</b><small>{dateLabel(event.date)} {event.time && `· ${event.time}`}</small></div></div>)
            : <Empty>Nenhum compromisso futuro cadastrado.</Empty>}
          <button className="link-button" onClick={() => setPage("events")}>Ver compromissos <ChevronRight size={15}/></button>
        </Card>
      </div>
    </>;

    if (page === "health") return <>
      <div className="content-grid">
        <Card title="Controle de peso" icon={Scale}>
          <div className="big-number">{currentWeight ? `${currentWeight} kg` : "—"}</div>
          <p className="muted">Seu registro mais recente</p>
          <form onSubmit={addWeight} className="form-stack">
            <Field label="Nova pesagem (kg)"><input type="number" min="0.1" step="0.1" value={weightInput} onChange={e => setWeightInput(e.target.value)} placeholder="Ex.: 54,5" required /></Field>
            <button className="primary" type="submit"><Plus size={16}/> Registrar peso</button>
          </form>
          <Field label="Meta de peso (kg)"><input type="number" min="0.1" step="0.1" value={data.weightGoal} onChange={e => update("weightGoal", e.target.value)} placeholder="Defina uma meta, se desejar" /></Field>
        </Card>
        <Card title="Hidratação diária" icon={Droplets}>
          <div className="big-number">{waterToday.toLocaleString("pt-BR")} <small>ml</small></div>
          <p className="muted">Meta diária: {Number(data.waterGoal).toLocaleString("pt-BR")} ml</p>
          <Progress value={waterToday / (Number(data.waterGoal) || 2000) * 100}/>
          <div className="quick-add">{[200,300,500].map(amount => <button className="soft-button" key={amount} onClick={() => addWater(amount)}>+{amount} ml</button>)}</div>
          <form className="inline-form" onSubmit={e => { e.preventDefault(); addWater(Number(waterInput)); }}>
            <input type="number" min="1" value={waterInput} onChange={e => setWaterInput(e.target.value)} aria-label="Quantidade de água em ml"/>
            <button className="primary" type="submit">Adicionar ml</button>
          </form>
          <Field label="Meta diária em ml"><input type="number" min="1" value={data.waterGoal} onChange={e => update("waterGoal", Number(e.target.value))}/></Field>
        </Card>
      </div>
      <Card title="Histórico de pesagens" icon={Activity}>
        {data.weights.length ? <div className="table-list">{[...data.weights].reverse().map(item => <div className="table-row" key={item.id}><span>{dateLabel(item.date)}</span><b>{item.value} kg</b><button className="icon-button danger" onClick={() => remove("weights", item.id)} aria-label="Excluir pesagem"><Trash2 size={16}/></button></div>)}</div> : <Empty>Suas pesagens aparecerão aqui conforme você registrar.</Empty>}
      </Card>
      <Card title="Registros de água de hoje" icon={Droplets}>
        {data.waterEntries.filter(item => item.date === todayISO()).length ? data.waterEntries.filter(item => item.date === todayISO()).slice().reverse().map(item => <div className="table-row" key={item.id}><span>{item.time}</span><b>{item.amount} ml</b><button className="icon-button danger" onClick={() => remove("waterEntries", item.id)} aria-label="Excluir registro"><Trash2 size={16}/></button></div>) : <Empty>Nenhum copo registrado hoje ainda.</Empty>}
      </Card>
    </>;

    if (page === "calendar") return <div className="content-grid calendar-layout">
      <Card title="Calendário mensal" icon={CalendarDays}>
        <div className="calendar-header">
          <button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))} aria-label="Mês anterior"><ChevronLeft size={18}/></button>
          <strong>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
          <button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))} aria-label="Próximo mês"><ChevronRight size={18}/></button>
        </div>
        <div className="calendar-grid">
          {weekdays.map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
          {calendarCells.map((day, index) => {
            const date = day ? `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : "";
            const hasActivity = date && (data.tasks.some(t => t.date === date) || data.events.some(e => e.date === date) || data.meals.some(m => m.date === date));
            return day ? <button key={index} className={`calendar-day ${date === selectedDate ? "calendar-selected" : ""} ${date === todayISO() ? "calendar-today" : ""}`} onClick={() => setDateFromCalendar(day)}>{day}{hasActivity && <span className="calendar-dot"/>}</button> : <span key={index}/>;
          })}
        </div>
      </Card>
      <Card title="Google Agenda" icon={CalendarDays} className="google-calendar-card">
        <div className="google-connect-copy">
          <div className="google-logo">G</div>
          <div>
            <b>Sincronize seus compromissos</b>
            <p className="muted">Conecte sua conta Google para visualizar eventos do Google Agenda aqui.</p>
          </div>
        </div>
        {googleStatus === "connected" ? (
          <button className="soft-button" onClick={disconnectGoogleCalendar}>Desconectar Google Agenda</button>
        ) : (
          <button
            className="google-button"
            onClick={connectGoogleCalendar}
            disabled={(!!googleClientId && !googleReady) || googleStatus === "connecting"}
          >
            {googleStatus === "connecting"
              ? "Conectando…"
              : !googleClientId
                ? "Configurar Google"
                : !googleReady
                  ? "Carregando Google…"
                  : "Conectar com Google"}
          </button>
        )}
        {googleMessage && <p className={`google-message ${googleStatus === "error" || googleStatus === "missing-config" ? "google-error" : ""}`}>{googleMessage}</p>}
        {googleEvents.length > 0 && <div className="google-events">
          <h4>Próximos eventos do Google</h4>
          {googleEvents.filter(event => event.date === selectedDate).map(event => (
            <div className="event-row" key={event.id}><div className="event-dot google-dot"/><div><b>{event.title}</b><small>{event.time}</small></div></div>
          ))}
          {!googleEvents.some(event => event.date === selectedDate) && <Empty>Nenhum evento do Google nesta data.</Empty>}
        </div>}
      </Card>
      <Card title={`Resumo de ${dateLabel(selectedDate)}`} icon={ClipboardList}>
        <h4>Tarefas</h4>
        {selectedTasks.length ? selectedTasks.map(task => <TaskRow key={task.id} item={task} onToggle={() => toggleTask(task.id)} onDelete={() => remove("tasks", task.id)}/>) : <Empty>Nenhuma tarefa.</Empty>}
        <h4>Compromissos</h4>
        {selectedEvents.length ? selectedEvents.map(event => <div className="event-row" key={event.id}><div className="event-dot"/><div><b>{event.title}</b><small>{event.time || "Sem horário"}</small></div></div>) : <Empty>Nenhum compromisso.</Empty>}
        <h4>Alimentação</h4>
        {selectedMeals.length ? selectedMeals.map(meal => <div className="meal-row" key={meal.id}><div><b>{meal.name}</b><small>{meal.type}</small></div></div>) : <Empty>Nenhum alimento registrado.</Empty>}
      </Card>
    </div>;

    if (page === "routine") return <Card title="Roteiro do meu dia" icon={ClipboardList}>
      <div className="date-control"><Field label="Escolha o dia"><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}/></Field></div>
      <form className="form-grid" onSubmit={addTask}>
        <Field label="O que você precisa fazer?"><input value={taskInput} onChange={e => setTaskInput(e.target.value)} placeholder="Ex.: Estudar, caminhar, organizar o quarto..." required/></Field>
        <Field label="Horário (opcional)"><input type="time" value={taskTime} onChange={e => setTaskTime(e.target.value)}/></Field>
        <button className="primary form-submit" type="submit"><Plus size={16}/> Adicionar tarefa</button>
      </form>
      <div className="section-subtitle"><b>{dateLabel(selectedDate)}</b><span>{selectedTasks.filter(t => t.done).length} de {selectedTasks.length} concluídas</span></div>
      {selectedTasks.length ? <div className="item-list">{selectedTasks.map(task => <TaskRow key={task.id} item={task} onToggle={() => toggleTask(task.id)} onDelete={() => remove("tasks", task.id)}/>)}</div> : <Empty>Nenhuma tarefa para este dia. Que tal planejar sua rotina?</Empty>}
    </Card>;

    if (page === "events") return <Card title="Adicionar compromisso" icon={CalendarDays}>
      <form className="form-grid" onSubmit={addEvent}>
        <Field label="Nome do compromisso"><input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex.: Faculdade, consulta, reunião..." required/></Field>
        <Field label="Data"><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} required/></Field>
        <Field label="Horário"><input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)}/></Field>
        <button className="primary form-submit" type="submit"><Plus size={16}/> Adicionar compromisso</button>
      </form>
      <div className="section-subtitle"><b>Minha agenda</b><span>{data.events.length} compromisso(s)</span></div>
      {data.events.length ? [...data.events].sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map(event => <div className="agenda-row" key={event.id}><div className="agenda-date"><b>{new Date(`${event.date}T12:00:00`).getDate()}</b><small>{new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR",{month:"short"})}</small></div><div className="agenda-info"><b>{event.title}</b><small>{dateLabel(event.date)} {event.time && `· ${event.time}`}</small></div><button className="icon-button danger" onClick={() => remove("events", event.id)} aria-label="Excluir compromisso"><Trash2 size={16}/></button></div>) : <Empty>Seus compromissos aparecerão aqui.</Empty>}
    </Card>;

    if (page === "workouts") return <>
      <Card title="Adicionar exercício" icon={Dumbbell}>
        <form className="form-grid workout-form" onSubmit={addWorkout}>
          <Field label="Dia da semana"><select value={workoutDay} onChange={e => setWorkoutDay(e.target.value)}>{weekDaysLong.map(day => <option key={day}>{day}</option>)}</select></Field>
          <Field label="Exercício"><input value={exercise} onChange={e => setExercise(e.target.value)} placeholder="Ex.: Agachamento" required/></Field>
          <Field label="Séries"><input type="number" min="1" value={sets} onChange={e => setSets(e.target.value)}/></Field>
          <Field label="Repetições"><input type="number" min="1" value={reps} onChange={e => setReps(e.target.value)}/></Field>
          <Field label="Carga (kg)"><input type="number" min="0" step="0.5" value={load} onChange={e => setLoad(e.target.value)} placeholder="Ex.: 20"/></Field>
          <button className="primary form-submit" type="submit"><Plus size={16}/> Adicionar exercício</button>
        </form>
      </Card>
      <div className="week-grid">
        {weekDaysLong.map(day => {
          const items = data.workouts.filter(item => item.day === day);
          return <Card title={day} icon={Dumbbell} key={day}>
            {items.length ? items.map(item => <div className="exercise-row" key={item.id}><div><b>{item.name}</b><small>{item.sets} séries × {item.reps} repetições</small><span className="load-pill">{item.load} kg</span></div><button className="icon-button danger" onClick={() => remove("workouts", item.id)} aria-label="Excluir exercício"><Trash2 size={16}/></button></div>) : <Empty>Dia livre ou sem exercícios cadastrados.</Empty>}
          </Card>;
        })}
      </div>
    </>;

    if (page === "food") return <>
      <Card title="Registrar alimentação" icon={Utensils}>
        <form className="form-grid" onSubmit={addMeal}>
          <Field label="Data"><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}/></Field>
          <Field label="Refeição"><select value={mealType} onChange={e => setMealType(e.target.value)}>{mealsTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
          <Field label="Alimento / descrição"><input value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="Ex.: Arroz, feijão e frango" required/></Field>
          <Field label="Calorias (opcional)"><input type="number" min="0" value={calories} onChange={e => setCalories(e.target.value)} placeholder="kcal"/></Field>
          <button className="primary form-submit" type="submit"><Plus size={16}/> Registrar alimento</button>
        </form>
      </Card>
      <div className="meal-grid">
        {mealsTypes.map(type => {
          const items = selectedMeals.filter(item => item.type === type);
          return <Card title={type} icon={Apple} key={type}>
            {items.length ? items.map(item => <div className="meal-row" key={item.id}><div><b>{item.name}</b>{item.calories > 0 && <small>{item.calories} kcal</small>}</div><button className="icon-button danger" onClick={() => remove("meals", item.id)} aria-label="Excluir alimento"><Trash2 size={16}/></button></div>) : <Empty>Nenhum alimento registrado.</Empty>}
          </Card>;
        })}
      </div>
      <p className="note">As calorias são opcionais e servem apenas como registro informativo.</p>
    </>;
    return null;
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark">✳</div><div><strong>my routine</strong><small>your personal space</small></div></div>
      <div className="nav-caption">MENU PRINCIPAL</div>
      <nav className="navigation">{navItems.map(([id,label,Icon]) => <button key={id} className={`nav-item ${page === id ? "selected" : ""}`} onClick={() => { setPage(id); setMobileMenu(false); }}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-note"><Heart size={19}/><b>Um dia de cada vez.</b><span>Organize sua vida, no seu ritmo.</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menu"><Menu size={21}/></button><div className="topbar-title"><span className="eyebrow">SEU ESPAÇO PESSOAL</span><h1>{title}</h1></div><div className="topbar-actions">{page !== "home" && <button className="home-return" onClick={() => setPage("home")}><Home size={16}/> Voltar ao início</button>}<div className="top-date">{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</div></div></header>
      {pageContent()}
      <footer className="footer">MY ROUTINE <span>·</span> Feito com carinho para você ♡</footer>
    </main>
  </div>;
}

function TaskRow({ item, onToggle, onDelete }) {
  return <div className="task-row"><label className="task-label"><input type="checkbox" checked={item.done} onChange={onToggle}/><span className={item.done ? "completed" : ""}>{item.title}</span>{item.time && <small>{item.time}</small>}</label><button className="icon-button danger" onClick={onDelete} aria-label="Excluir tarefa"><Trash2 size={16}/></button></div>;
}
