import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const icons = {
  music: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  users: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  wallet: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <path d="M18 12h.01" />
    </svg>
  ),
  chart: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  check: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  clock: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  plus: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  ),
  lock: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  refresh: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12A9 9 0 0 1 18.4 5.6L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  trash: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  ),
};

const paymentMethods = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "card", label: "Cartão" },
  { value: "transfer", label: "Transferência" },
];

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function referenceDate(month) {
  return `${month}-01`;
}

function startOfMonth(month) {
  return referenceDate(month);
}

function endOfMonth(month) {
  const [year, value] = month.split("-").map(Number);
  return localDate(new Date(year, value, 0));
}

function monthFromDate(date) {
  return String(date || "").slice(0, 7) || currentMonth();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function monthLabel(month) {
  const [year, value] = month.split("-");
  const date = new Date(Number(year), Number(value) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(false);
  const [view, setView] = useState("payments");
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [reportStart, setReportStart] = useState(startOfMonth(currentMonth()));
  const [reportEnd, setReportEnd] = useState(endOfMonth(currentMonth()));
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({
    modalities: [],
    students: [],
    paymentStatuses: [],
    payments: [],
    profiles: [],
  });

  const isAdmin = profile?.role === "admin";

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 3000);
  }, []);

  const loadProfile = useCallback(async (userId) => {
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;
    setProfile(profileRow);
    return profileRow;
  }, []);

  const loadData = useCallback(
    async (role = profile?.role) => {
      if (!session?.user) return;

      setAppLoading(true);
      setError("");

      try {
        const selectedReference = referenceDate(month);
        const shouldLoadPayments = role === "admin";

        const requests = [
          supabase.from("modalities").select("id, name, default_monthly_value, is_active").order("name"),
          supabase
            .from("students")
            .select("id, full_name, phone, monthly_value, due_day, status, notes, modality:modalities(id, name)")
            .order("full_name"),
          supabase
            .from("payment_statuses")
            .select("student_id, reference_month, paid_at")
            .eq("reference_month", selectedReference),
        ];

        if (shouldLoadPayments) {
          requests.push(
            supabase
              .from("payments")
              .select(
                "id, student_id, reference_month, paid_at, amount, method, note, registered_by, created_at, student:students(id, full_name, modality:modalities(id, name))",
              )
              .gte("paid_at", reportStart)
              .lte("paid_at", reportEnd)
              .order("paid_at", { ascending: false }),
            supabase.from("profiles").select("id, email, full_name, role, created_at").order("full_name"),
          );
        }

        const [modalitiesResult, studentsResult, statusesResult, paymentsResult, profilesResult] =
          await Promise.all(requests);

        for (const result of [
          modalitiesResult,
          studentsResult,
          statusesResult,
          paymentsResult,
          profilesResult,
        ]) {
          if (result?.error) throw result.error;
        }

        setData({
          modalities: modalitiesResult.data || [],
          students: studentsResult.data || [],
          paymentStatuses: statusesResult.data || [],
          payments: paymentsResult?.data || [],
          profiles: profilesResult?.data || [],
        });
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setAppLoading(false);
      }
    },
    [month, profile?.role, reportEnd, reportStart, session?.user],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!mounted) return;
      setSession(sessionData.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setData({ modalities: [], students: [], paymentStatuses: [], payments: [], profiles: [] });
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    loadProfile(session.user.id).catch((profileError) => {
      setError(profileError.message);
    });
  }, [loadProfile, session?.user]);

  useEffect(() => {
    if (session?.user && profile?.role) {
      loadData(profile.role);
    }
  }, [loadData, profile?.role, session?.user]);

  const statusByStudent = useMemo(() => {
    return new Map(data.paymentStatuses.map((status) => [status.student_id, status]));
  }, [data.paymentStatuses]);

  const enrichedStudents = useMemo(() => {
    return data.students.map((student) => {
      const paymentStatus = statusByStudent.get(student.id);
      const status = getPaymentStatus(student, paymentStatus, month);

      return {
        ...student,
        paymentStatus,
        paymentStatusKey: status.key,
        paymentStatusLabel: status.label,
        paymentStatusClass: status.className,
      };
    });
  }, [data.students, month, statusByStudent]);

  const filteredStudents = useMemo(() => {
    const term = normalizeText(search);

    return enrichedStudents.filter((student) => {
      const matchesSearch =
        !term ||
        normalizeText(student.full_name).includes(term) ||
        normalizeText(student.phone).includes(term) ||
        normalizeText(student.modality?.name).includes(term);
      const matchesModality = modalityFilter === "all" || student.modality?.id === modalityFilter;
      const matchesStatus = statusFilter === "all" || student.paymentStatusKey === statusFilter;

      return matchesSearch && matchesModality && matchesStatus;
    });
  }, [enrichedStudents, modalityFilter, search, statusFilter]);

  const pendingStudents = useMemo(() => {
    return enrichedStudents
      .filter((student) => student.status === "active" && student.paymentStatusKey !== "paid")
      .sort((a, b) => a.due_day - b.due_day || a.full_name.localeCompare(b.full_name));
  }, [enrichedStudents]);

  const totals = useMemo(() => {
    const activeStudents = enrichedStudents.filter((student) => student.status === "active");
    const paidStudents = activeStudents.filter((student) => student.paymentStatusKey === "paid");
    const lateStudents = activeStudents.filter((student) => student.paymentStatusKey === "late");
    const pendingValue = activeStudents
      .filter((student) => student.paymentStatusKey !== "paid")
      .reduce((sum, student) => sum + Number(student.monthly_value), 0);
    const today = localDate();
    const receivedToday = data.payments
      .filter((payment) => payment.paid_at === today)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const receivedMonth = data.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      activeCount: activeStudents.length,
      paidCount: paidStudents.length,
      lateCount: lateStudents.length,
      pendingCount: activeStudents.length - paidStudents.length,
      pendingValue,
      receivedToday,
      receivedMonth,
    };
  }, [data.payments, enrichedStudents]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setView("payments");
  }

  async function handleAddStudent(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const payload = {
      full_name: String(form.get("full_name")).trim(),
      phone: String(form.get("phone")).trim() || null,
      modality_id: form.get("modality_id"),
      monthly_value: Number(form.get("monthly_value")),
      due_day: Number(form.get("due_day")),
      notes: String(form.get("notes")).trim() || null,
      status: "active",
    };

    const { error: insertError } = await supabase.from("students").insert(payload);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    event.currentTarget.reset();
    showToast("Aluno cadastrado.");
    loadData();
  }

  async function handleUpdateStudent(event) {
    event.preventDefault();
    if (!editingStudent) return;

    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name")).trim(),
      phone: String(form.get("phone")).trim() || null,
      modality_id: form.get("modality_id"),
      monthly_value: Number(form.get("monthly_value")),
      due_day: Number(form.get("due_day")),
      notes: String(form.get("notes")).trim() || null,
      status: form.get("status"),
    };

    const { error: updateError } = await supabase
      .from("students")
      .update(payload)
      .eq("id", editingStudent.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setEditingStudent(null);
    showToast("Aluno atualizado.");
    loadData();
  }

  async function handlePayment(event) {
    event.preventDefault();
    if (!selectedStudent) return;

    const form = new FormData(event.currentTarget);
    const nextMonth = String(form.get("reference_month"));
    const payload = {
      student_id: selectedStudent.id,
      reference_month: `${nextMonth}-01`,
      paid_at: form.get("paid_at"),
      amount: Number(form.get("amount")),
      method: form.get("method"),
      note: String(form.get("note")).trim() || null,
      registered_by: session.user.id,
    };

    const { error: insertError } = await supabase.from("payments").insert(payload);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Esse aluno já foi marcado como pago nesse mês."
          : insertError.message,
      );
      return;
    }

    setMonth(nextMonth);
    setSelectedStudent(null);
    showToast("Pagamento registrado.");
    if (nextMonth === month) {
      loadData();
    }
  }

  async function handleUpdatePayment(event) {
    event.preventDefault();
    if (!editingPayment) return;

    const form = new FormData(event.currentTarget);
    const nextReferenceMonth = String(form.get("reference_month"));
    const payload = {
      student_id: form.get("student_id"),
      reference_month: `${nextReferenceMonth}-01`,
      paid_at: form.get("paid_at"),
      amount: Number(form.get("amount")),
      method: form.get("method"),
      note: String(form.get("note")).trim() || null,
    };

    const { error: updateError } = await supabase
      .from("payments")
      .update(payload)
      .eq("id", editingPayment.id);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "Esse aluno já tem pagamento lançado nesse mês."
          : updateError.message,
      );
      return;
    }

    setEditingPayment(null);
    showToast("Pagamento corrigido.");
    if (nextReferenceMonth !== month) {
      setMonth(nextReferenceMonth);
    } else {
      loadData();
    }
  }

  async function handleUpdateProfile(event, profileId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name")).trim(),
      role: form.get("role"),
    };

    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", profileId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    showToast("Usuário atualizado.");
    loadData();
    if (profileId === session.user.id) {
      loadProfile(profileId);
    }
  }

  async function handleStudentStatus(student) {
    const nextStatus = student.status === "active" ? "paused" : "active";
    const { error: updateError } = await supabase
      .from("students")
      .update({ status: nextStatus })
      .eq("id", student.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    showToast(nextStatus === "active" ? "Aluno ativado." : "Aluno pausado.");
    loadData();
  }

  async function handleDeletePayment(paymentId) {
    if (!window.confirm("Estornar esse pagamento?")) return;

    const { error: deleteError } = await supabase.from("payments").delete().eq("id", paymentId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    showToast("Pagamento estornado.");
    loadData();
  }

  if (!isSupabaseConfigured) {
    return <ConfigurationScreen />;
  }

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="brand-mark">{icons.music}</span>
          <div>
            <strong>Escola de Música</strong>
            <span>Mensalidades</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          <NavButton active={view === "payments"} onClick={() => setView("payments")} icon={icons.wallet}>
            Pagamentos
          </NavButton>
          <NavButton active={view === "pending"} onClick={() => setView("pending")} icon={icons.clock}>
            Pendências
          </NavButton>
          <NavButton active={view === "students"} onClick={() => setView("students")} icon={icons.users}>
            Alunos
          </NavButton>
          {isAdmin && (
            <>
              <NavButton active={view === "reports"} onClick={() => setView("reports")} icon={icons.chart}>
                Relatórios
              </NavButton>
              <NavButton active={view === "users"} onClick={() => setView("users")} icon={icons.lock}>
                Usuários
              </NavButton>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="role-pill">{isAdmin ? "Administrador" : "Funcionária"}</span>
          <button className="button ghost full" onClick={handleSignOut}>
            {icons.lock}
            Sair
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{viewTitle(view)}</h1>
            <p>
              {monthLabel(month)} · {isAdmin ? "visão completa" : "visão operacional"}
            </p>
          </div>

          <div className="topbar-actions">
            <label className="field compact">
              <span>Mês</span>
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  const nextMonth = event.target.value || currentMonth();
                  setMonth(nextMonth);
                  setReportStart(startOfMonth(nextMonth));
                  setReportEnd(endOfMonth(nextMonth));
                  setSelectedStudent(null);
                }}
              />
            </label>
            <button className="button secondary" onClick={() => loadData()}>
              {icons.refresh}
              Atualizar
            </button>
          </div>
        </header>

        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => setError("")}>Fechar</button>
          </div>
        )}

        {appLoading && <div className="loading-bar" />}

        {view === "payments" && (
          <PaymentsView
            data={data}
            filteredStudents={filteredStudents}
            isAdmin={isAdmin}
            month={month}
            selectedStudent={selectedStudent}
            setModalityFilter={setModalityFilter}
            setSearch={setSearch}
            setSelectedStudent={setSelectedStudent}
            setStatusFilter={setStatusFilter}
            modalityFilter={modalityFilter}
            search={search}
            statusFilter={statusFilter}
            totals={totals}
            onPayment={handlePayment}
          />
        )}

        {view === "pending" && (
          <PendingView
            isAdmin={isAdmin}
            month={month}
            pendingStudents={pendingStudents}
            totals={totals}
            onSelectStudent={(student) => {
              setSelectedStudent(student);
              setView("payments");
            }}
          />
        )}

        {view === "students" && (
          <StudentsView
            data={data}
            editingStudent={editingStudent}
            filteredStudents={filteredStudents}
            modalityFilter={modalityFilter}
            search={search}
            setEditingStudent={setEditingStudent}
            setModalityFilter={setModalityFilter}
            setSearch={setSearch}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
            onAddStudent={handleAddStudent}
            onCancelEdit={() => setEditingStudent(null)}
            onUpdateStudent={handleUpdateStudent}
            onStudentStatus={handleStudentStatus}
          />
        )}

        {view === "reports" && isAdmin && (
          <ReportsView
            data={data}
            reportEnd={reportEnd}
            reportStart={reportStart}
            totals={totals}
            onDeletePayment={handleDeletePayment}
            onEditPayment={setEditingPayment}
            onExport={() => exportPaymentsCsv(data.payments, reportStart, reportEnd)}
            onReportEnd={setReportEnd}
            onReportStart={setReportStart}
            editingPayment={editingPayment}
            onCancelPaymentEdit={() => setEditingPayment(null)}
            onUpdatePayment={handleUpdatePayment}
          />
        )}

        {view === "users" && isAdmin && (
          <UsersView
            currentUserId={session.user.id}
            profiles={data.profiles}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {icons.check}
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

function ConfigurationScreen() {
  return (
    <main className="auth-screen">
      <section className="auth-card wide">
        <span className="brand-mark dark">{icons.music}</span>
        <h1>Conecte o Supabase</h1>
        <p>
          Crie um arquivo <code>.env.local</code> com a URL e a chave pública do seu projeto.
          Depois rode o SQL de <code>supabase/schema.sql</code> no SQL Editor.
        </p>
        <pre>{`VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publishable-ou-anon`}</pre>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-mark dark">{icons.music}</span>
        <h1>Carregando</h1>
        <p>Verificando sessão no Supabase.</p>
      </section>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const fullName = String(form.get("full_name") || "").trim();

    const response =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (response.error) {
      setMessage(response.error.message);
    } else if (mode === "signup") {
      setMessage("Conta criada. Se a confirmação por email estiver ligada, confirme antes de entrar.");
    }

    setLoading(false);
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-mark dark">{icons.music}</span>
        <h1>Mensalidades</h1>
        <p>Entre com o email cadastrado no Supabase Auth.</p>

        <div className="segmented">
          <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
            Entrar
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Criar conta
          </button>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          {mode === "signup" && (
            <label className="field">
              <span>Nome</span>
              <input name="full_name" required placeholder="Nome completo" />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input name="email" type="email" required placeholder="email@exemplo.com" />
          </label>

          <label className="field">
            <span>Senha</span>
            <input name="password" type="password" minLength="6" required placeholder="Sua senha" />
          </label>

          {message && <p className="form-message">{message}</p>}

          <button className="button primary full" disabled={loading}>
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}

function PaymentsView(props) {
  return (
    <>
      <MetricGrid totals={props.totals} isAdmin={props.isAdmin} />
      <section className="split-grid">
        <div>
          <StudentFilters {...props} />
          <StudentTable students={props.filteredStudents} context="payments" onSelect={props.setSelectedStudent} />
        </div>
        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>Registrar pagamento</h2>
              <p>Selecione um aluno pendente na lista para dar baixa.</p>
            </div>
          </div>
          <div className="panel-body">
            {props.selectedStudent ? (
              <PaymentForm student={props.selectedStudent} month={props.month} onSubmit={props.onPayment} />
            ) : (
              <EmptyState title="Nenhum aluno selecionado" text="Clique em lançar para preencher o pagamento." />
            )}
          </div>
        </aside>
      </section>
    </>
  );
}

function PendingView({ isAdmin, month, pendingStudents, totals, onSelectStudent }) {
  const today = localDate();
  const dueTodayCount = pendingStudents.filter(
    (student) => `${month}-${String(student.due_day).padStart(2, "0")}` === today,
  ).length;

  return (
    <>
      <section className="metric-grid" aria-label="Resumo de pendências">
        <Metric label="Pendentes" value={totals.pendingCount} detail="Ainda sem baixa no mês" icon={icons.clock} />
        <Metric label="Atrasados" value={totals.lateCount} detail="Vencimento já passou" icon={icons.wallet} />
        <Metric label="Vencem hoje" value={dueTodayCount} detail="Precisam de acompanhamento" icon={icons.check} />
        <Metric
          label={isAdmin ? "Valor em aberto" : "Alunos ativos"}
          value={isAdmin ? formatMoney(totals.pendingValue) : totals.activeCount}
          detail={isAdmin ? "Estimativa das mensalidades" : "Matrículas acompanhadas"}
          icon={icons.users}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Pendências do mês</h2>
            <p>Alunos ativos sem pagamento lançado em {monthLabel(month)}.</p>
          </div>
        </div>
        <PendingTable students={pendingStudents} isAdmin={isAdmin} onSelectStudent={onSelectStudent} />
      </section>
    </>
  );
}

function PendingTable({ students, isAdmin, onSelectStudent }) {
  if (!students.length) {
    return <EmptyState title="Tudo certo por aqui" text="Não há pendências no mês selecionado." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Modalidade</th>
            <th>Vencimento</th>
            {isAdmin && <th>Valor</th>}
            <th>Status</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td>
                <span className="student-cell">
                  <strong>{student.full_name}</strong>
                  <span>{student.phone || "Sem telefone"}</span>
                </span>
              </td>
              <td>{student.modality?.name || "-"}</td>
              <td>Dia {student.due_day}</td>
              {isAdmin && <td>{formatMoney(student.monthly_value)}</td>}
              <td>
                <span className={`badge ${student.paymentStatusClass}`}>{student.paymentStatusLabel}</span>
              </td>
              <td>
                <button className="table-action primary" onClick={() => onSelectStudent(student)}>
                  {icons.plus}
                  Lançar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentsView(props) {
  const isEditing = Boolean(props.editingStudent);

  return (
    <section className="split-grid">
      <div>
        <StudentFilters {...props} />
        <StudentTable
          students={props.filteredStudents}
          context="students"
          onEditStudent={props.setEditingStudent}
          onStudentStatus={props.onStudentStatus}
        />
      </div>
      <aside className="panel">
        <div className="panel-header">
          <div>
            <h2>{isEditing ? "Editar aluno" : "Novo aluno"}</h2>
            <p>
              {isEditing
                ? "Atualize dados, valor, vencimento e status."
                : "Cadastre a matrícula para aparecer no controle mensal."}
            </p>
          </div>
        </div>
        <div className="panel-body">
          <StudentForm
            key={props.editingStudent?.id || "new-student"}
            modalities={props.data.modalities}
            student={props.editingStudent}
            onCancel={props.onCancelEdit}
            onSubmit={isEditing ? props.onUpdateStudent : props.onAddStudent}
          />
        </div>
      </aside>
    </section>
  );
}

function ReportsView({
  data,
  editingPayment,
  reportEnd,
  reportStart,
  totals,
  onCancelPaymentEdit,
  onDeletePayment,
  onEditPayment,
  onExport,
  onReportEnd,
  onReportStart,
  onUpdatePayment,
}) {
  const byModality = groupPayments(data.payments, (payment) => payment.student?.modality?.name || "Sem modalidade");
  const byMethod = groupPayments(data.payments, (payment) => paymentMethodLabel(payment.method));
  const byDay = groupPayments(data.payments, (payment) => formatDate(payment.paid_at));

  return (
    <>
      <MetricGrid totals={totals} isAdmin />
      <section className="panel report-filter">
        <div className="panel-header">
          <div>
            <h2>Período do relatório</h2>
            <p>Filtre por data de recebimento e exporte o histórico.</p>
          </div>
        </div>
        <div className="panel-body report-controls">
          <label className="field">
            <span>Início</span>
            <input type="date" value={reportStart} onChange={(event) => onReportStart(event.target.value)} />
          </label>
          <label className="field">
            <span>Fim</span>
            <input type="date" value={reportEnd} onChange={(event) => onReportEnd(event.target.value)} />
          </label>
          <button className="button secondary" onClick={onExport}>
            Exportar CSV
          </button>
        </div>
      </section>
      <section className="split-grid">
        <div>
          <ChartPanel title="Recebido por modalidade" values={byModality} />
          <ChartPanel title="Recebido por forma de pagamento" values={byMethod} />
        </div>
        <div>
          <ChartPanel title="Recebido por dia" values={byDay} />
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Histórico do período</h2>
            <p>Somente o administrador acessa e corrige os valores recebidos.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Aluno</th>
                <th>Modalidade</th>
                <th>Forma</th>
                <th>Valor</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length ? (
                data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paid_at)}</td>
                    <td>{payment.student?.full_name || "Aluno removido"}</td>
                    <td>{payment.student?.modality?.name || "-"}</td>
                    <td>{paymentMethodLabel(payment.method)}</td>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>
                      <span className="table-actions">
                        <button className="table-action secondary" onClick={() => onEditPayment(payment)}>
                          Editar
                        </button>
                        <button className="table-action danger" onClick={() => onDeletePayment(payment.id)}>
                          {icons.trash}
                          Estornar
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="muted">
                    Nenhum pagamento registrado no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {editingPayment && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Corrigir pagamento</h2>
              <p>Altere aluno, mês, data, valor, forma ou observação.</p>
            </div>
          </div>
          <div className="panel-body">
            <PaymentEditForm
              payment={editingPayment}
              students={data.students}
              onCancel={onCancelPaymentEdit}
              onSubmit={onUpdatePayment}
            />
          </div>
        </section>
      )}
    </>
  );
}

function UsersView({ currentUserId, profiles, onUpdateProfile }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Usuários e permissões</h2>
          <p>Defina quem é administrador e quem é funcionária.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((user) => (
              <tr key={user.id}>
                <td colSpan="4">
                  <form className="user-row" onSubmit={(event) => onUpdateProfile(event, user.id)}>
                    <input name="full_name" defaultValue={user.full_name} placeholder="Nome do usuário" />
                    <span>{user.email || user.id}</span>
                    <select name="role" defaultValue={user.role} disabled={user.id === currentUserId}>
                      <option value="staff">Funcionária</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <button className="table-action primary" disabled={user.id === currentUserId}>
                      Salvar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StudentFilters({
  data,
  search,
  modalityFilter,
  statusFilter,
  setSearch,
  setModalityFilter,
  setStatusFilter,
}) {
  return (
    <section className="panel filter-panel">
      <div className="panel-header">
        <div>
          <h2>Alunos e situação</h2>
          <p>Filtre por nome, telefone, modalidade ou status.</p>
        </div>
      </div>
      <div className="panel-body search-box">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          type="search"
          placeholder="Buscar aluno, telefone ou modalidade"
        />
        <select value={modalityFilter} onChange={(event) => setModalityFilter(event.target.value)}>
          <option value="all">Todas as modalidades</option>
          {data.modalities.map((modality) => (
            <option key={modality.id} value={modality.id}>
              {modality.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Todos os status</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
          <option value="late">Atrasado</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>
    </section>
  );
}

function StudentTable({ students, context, onEditStudent, onSelect, onStudentStatus }) {
  if (!students.length) {
    return <EmptyState title="Nenhum aluno encontrado" text="Altere os filtros ou cadastre um novo aluno." />;
  }

  return (
    <section className="panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Modalidade</th>
              <th>Vencimento</th>
              <th>Mensalidade</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const canPay = student.paymentStatusKey === "pending" || student.paymentStatusKey === "late";

              return (
                <tr key={student.id}>
                  <td>
                    <span className="student-cell">
                      <strong>{student.full_name}</strong>
                      <span>{student.phone || "Sem telefone"}</span>
                    </span>
                  </td>
                  <td>{student.modality?.name || "-"}</td>
                  <td>Dia {student.due_day}</td>
                  <td>{formatMoney(student.monthly_value)}</td>
                  <td>
                    <span className={`badge ${student.paymentStatusClass}`}>{student.paymentStatusLabel}</span>
                  </td>
                  <td>
                    {context === "payments" ? (
                      canPay ? (
                        <button className="table-action primary" onClick={() => onSelect(student)}>
                          {icons.plus}
                          Lançar
                        </button>
                      ) : (
                        <span className="muted">
                          {student.paymentStatus?.paid_at
                            ? `Pago em ${formatDate(student.paymentStatus.paid_at)}`
                            : "Sem ação"}
                        </span>
                      )
                    ) : (
                      <span className="table-actions">
                        <button className="table-action secondary" onClick={() => onEditStudent(student)}>
                          Editar
                        </button>
                        <button className="table-action secondary" onClick={() => onStudentStatus(student)}>
                          {student.status === "active" ? "Pausar" : "Ativar"}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricGrid({ totals, isAdmin }) {
  if (isAdmin) {
    return (
      <section className="metric-grid" aria-label="Resumo financeiro">
        <Metric label="Recebido hoje" value={formatMoney(totals.receivedToday)} detail="Pagamentos de hoje" icon={icons.wallet} />
        <Metric label="Recebido no período" value={formatMoney(totals.receivedMonth)} detail={`${totals.paidCount} pagamentos`} icon={icons.chart} />
        <Metric label="Pendência estimada" value={formatMoney(totals.pendingValue)} detail="Mensalidades não pagas" icon={icons.clock} />
        <Metric label="Alunos ativos" value={totals.activeCount} detail={`${totals.lateCount} atrasados`} icon={icons.users} />
      </section>
    );
  }

  return (
    <section className="metric-grid" aria-label="Resumo operacional">
      <Metric label="Alunos pagos" value={totals.paidCount} detail="No mês selecionado" icon={icons.check} />
      <Metric label="Pendentes" value={totals.pendingCount} detail="Ainda precisam de baixa" icon={icons.clock} />
      <Metric label="Atrasados" value={totals.lateCount} detail="Vencimento já passou" icon={icons.wallet} />
      <Metric label="Alunos ativos" value={totals.activeCount} detail="Matrículas acompanhadas" icon={icons.users} />
    </section>
  );
}

function Metric({ label, value, detail, icon }) {
  return (
    <article className="metric-card">
      <div className="metric-head">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PaymentForm({ student, month, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="selected-student">
        <strong>{student.full_name}</strong>
        <span>
          {student.modality?.name || "Sem modalidade"} · vencimento dia {student.due_day}
        </span>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Referente</span>
          <input name="reference_month" type="month" defaultValue={month} required />
        </label>
        <label className="field">
          <span>Pago em</span>
          <input name="paid_at" type="date" defaultValue={localDate()} required />
        </label>
        <label className="field">
          <span>Valor</span>
          <input name="amount" type="number" min="0" step="0.01" defaultValue={student.monthly_value} required />
        </label>
        <label className="field">
          <span>Forma</span>
          <select name="method">
            {paymentMethods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Observação</span>
          <textarea name="note" placeholder="Desconto, pagamento parcial, bolsa..." />
        </label>
      </div>

      <button className="button primary full form-actions">{icons.check} Confirmar baixa</button>
    </form>
  );
}

function PaymentEditForm({ onCancel, onSubmit, payment, students }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <label className="field wide">
          <span>Aluno</span>
          <select name="student_id" defaultValue={payment.student_id} required>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Referente</span>
          <input name="reference_month" type="month" defaultValue={monthFromDate(payment.reference_month)} required />
        </label>
        <label className="field">
          <span>Pago em</span>
          <input name="paid_at" type="date" defaultValue={payment.paid_at} required />
        </label>
        <label className="field">
          <span>Valor</span>
          <input name="amount" type="number" min="0" step="0.01" defaultValue={payment.amount} required />
        </label>
        <label className="field">
          <span>Forma</span>
          <select name="method" defaultValue={payment.method}>
            {paymentMethods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Observação</span>
          <textarea name="note" defaultValue={payment.note || ""} />
        </label>
      </div>
      <div className="button-row form-actions">
        <button className="button primary">Salvar correção</button>
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function StudentForm({ modalities, onCancel, onSubmit, student }) {
  const isEditing = Boolean(student);

  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <label className="field wide">
          <span>Nome</span>
          <input name="full_name" required placeholder="Nome do aluno" defaultValue={student?.full_name || ""} />
        </label>
        <label className="field">
          <span>Telefone</span>
          <input name="phone" placeholder="(00) 00000-0000" defaultValue={student?.phone || ""} />
        </label>
        <label className="field">
          <span>Modalidade</span>
          <select name="modality_id" required defaultValue={student?.modality?.id || ""}>
            {modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mensalidade</span>
          <input
            name="monthly_value"
            type="number"
            min="0"
            step="0.01"
            defaultValue={student?.monthly_value || "150"}
            required
          />
        </label>
        <label className="field">
          <span>Vencimento</span>
          <input name="due_day" type="number" min="1" max="31" defaultValue={student?.due_day || "10"} required />
        </label>
        {isEditing && (
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={student.status}>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
        )}
        <label className="field wide">
          <span>Observações</span>
          <textarea name="notes" placeholder="Horário, desconto, responsável..." defaultValue={student?.notes || ""} />
        </label>
      </div>
      <div className="button-row form-actions">
        <button className="button primary">{isEditing ? "Salvar alterações" : "Cadastrar aluno"}</button>
        {isEditing && (
          <button className="button secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function ChartPanel({ title, values }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((entry) => entry[1]));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{entries.length ? "Valores do mês selecionado." : "Sem pagamentos neste mês."}</p>
        </div>
      </div>
      <div className="panel-body">
        {entries.length ? (
          <div className="chart-list">
            {entries.map(([label, value]) => (
              <div className="bar-row" key={label}>
                <strong>{label}</strong>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
                </span>
                <span>{formatMoney(value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem dados" text="Os gráficos aparecem depois dos lançamentos." />
        )}
      </div>
    </section>
  );
}

function EmptyState({ title, text }) {
  return (
    <section className="empty-state">
      {icons.wallet}
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function NavButton({ active, children, icon, onClick }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function getPaymentStatus(student, paymentStatus, month) {
  if (student.status !== "active") {
    return { key: "inactive", label: "Inativo", className: "neutral" };
  }

  if (paymentStatus) {
    return { key: "paid", label: "Pago", className: "success" };
  }

  const dueDate = `${month}-${String(student.due_day).padStart(2, "0")}`;
  if (month < currentMonth() || dueDate < localDate()) {
    return { key: "late", label: "Atrasado", className: "danger" };
  }

  return { key: "pending", label: "Pendente", className: "warning" };
}

function groupPayments(payments, getKey) {
  return payments.reduce((groups, payment) => {
    const key = getKey(payment);
    groups[key] = (groups[key] || 0) + Number(payment.amount);
    return groups;
  }, {});
}

function paymentMethodLabel(value) {
  return paymentMethods.find((method) => method.value === value)?.label || value;
}

function exportPaymentsCsv(payments, start, end) {
  const rows = [
    ["Data", "Aluno", "Modalidade", "Forma", "Valor", "Observação"],
    ...payments.map((payment) => [
      formatDate(payment.paid_at),
      payment.student?.full_name || "Aluno removido",
      payment.student?.modality?.name || "-",
      paymentMethodLabel(payment.method),
      String(payment.amount).replace(".", ","),
      payment.note || "",
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pagamentos-${start}-a-${end}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function viewTitle(view) {
  if (view === "students") return "Cadastro de alunos";
  if (view === "reports") return "Relatórios financeiros";
  if (view === "pending") return "Pendências";
  if (view === "users") return "Usuários";
  return "Pagamentos do mês";
}

export default App;
