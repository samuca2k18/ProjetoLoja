import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const emptyData = {
  modalities: [],
  guardians: [],
  enrollments: [],
  paymentStatuses: [],
  payments: [],
  chartPayments: [],
  profiles: [],
};

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

function shortMonthLabel(month) {
  const [year, value] = month.split("-");
  const date = new Date(Number(year), Number(value) - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "short" });
  return label.replace(".", "").trim();
}

function monthsAgoStart(count) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - (count - 1));
  return localDate(date);
}

function buildMonthlyReceived(payments, monthCount = 12) {
  const buckets = [];
  const now = new Date();
  now.setDate(1);

  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ month: key, label: shortMonthLabel(key), amount: 0, byMethod: {} });
  }

  const byMonth = new Map(buckets.map((item) => [item.month, item]));
  for (const payment of payments) {
    const key = monthFromDate(payment.paid_at);
    const bucket = byMonth.get(key);
    if (bucket) {
      const value = Number(payment.amount || 0);
      bucket.amount += value;
      const method = payment.method || "other";
      bucket.byMethod[method] = (bucket.byMethod[method] || 0) + value;
    }
  }

  return buckets;
}

function chartScopePayments(payments, monthCount = 12) {
  const start = monthsAgoStart(monthCount);
  return (payments || []).filter((payment) => payment.paid_at >= start);
}

function buildMethodBreakdown(payments) {
  const groups = new Map(
    paymentMethods.map((method) => [
      method.value,
      { value: method.value, label: method.label, count: 0, amount: 0 },
    ]),
  );

  for (const payment of payments || []) {
    const key = payment.method || "other";
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        value: key,
        label: paymentMethodLabel(key),
        count: 0,
        amount: 0,
      };
      groups.set(key, entry);
    }
    entry.count += 1;
    entry.amount += Number(payment.amount || 0);
  }

  return [...groups.values()]
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.amount - a.amount || b.count - a.count);
}

const methodColors = {
  pix: "#1f9e89",
  cash: "#3f8f3a",
  card: "#5b5fc7",
  transfer: "#d08a1c",
  other: "#8a948f",
};

function methodColor(value) {
  return methodColors[value] || methodColors.other;
}

function lastDayOfMonth(month) {
  const [year, value] = String(month).split("-").map(Number);
  return new Date(year, value, 0).getDate();
}

// Vencimento dia 31 em fevereiro vira o último dia do mês (28/29), etc.
function effectiveDueDay(month, dueDay) {
  const day = Math.max(1, Number(dueDay) || 1);
  return Math.min(day, lastDayOfMonth(month));
}

function dueDateFor(month, dueDay) {
  return `${month}-${String(effectiveDueDay(month, dueDay)).padStart(2, "0")}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const errorTranslations = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Seu e-mail ainda não foi confirmado."],
  [/user not found/i, "Usuário não encontrado."],
  [/rate limit|too many requests|over_request_rate_limit/i, "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."],
  [/failed to fetch|networkerror|network request failed|load failed/i, "Sem conexão com o servidor. Verifique a internet e tente de novo."],
  [/jwt expired|invalid jwt|refresh token/i, "Sua sessão expirou. Entre novamente."],
  [/password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/signups not allowed|signup is disabled/i, "Cadastro desativado. Peça acesso ao administrador."],
  [/row-level security|permission denied/i, "Você não tem permissão para fazer isso."],
  [/guardians_email_unique/i, "Já existe um responsável com esse e-mail."],
  [/duplicate key/i, "Esse registro já existe."],
  [/violates foreign key/i, "Esse registro está ligado a outros dados e não pode ser alterado assim."],
  [/violates check constraint/i, "Algum valor informado é inválido. Confira os campos."],
  [/invalid input syntax/i, "Algum campo está com formato inválido."],
];

function translateError(error) {
  const message = String(error?.message || error || "").trim();
  if (!message) return "Algo deu errado. Tente de novo.";
  for (const [pattern, translated] of errorTranslations) {
    if (pattern.test(message)) return translated;
  }
  if (error?.code === "PGRST116") return "Registro não encontrado.";
  // Mensagens do nosso banco já vêm em português.
  if (/[ãõçáéíóúâêô]|\b(não|já|para|uma|pagamento|matrícula|aluno|valor)\b/i.test(message)) return message;
  return `Não foi possível concluir a operação. Tente de novo. (${message})`;
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
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [paymentOrigin, setPaymentOrigin] = useState(null); // null | "pending"
  const paymentPanelRef = useRef(null);
  const [editingEnrollment, setEditingEnrollment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [reportStart, setReportStart] = useState(startOfMonth(currentMonth()));
  const [reportEnd, setReportEnd] = useState(endOfMonth(currentMonth()));
  const debouncedReportStart = useDebouncedValue(reportStart, 500);
  const debouncedReportEnd = useDebouncedValue(reportEnd, 500);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState(emptyData);

  const isAdmin = profile?.role === "admin";
  // "v2" = banco já atualizado (histórico preservado, aprovação de contas).
  const hasHistorySchema = Boolean(profile && Object.prototype.hasOwnProperty.call(profile, "approved"));
  const isPendingApproval = hasHistorySchema && profile?.approved === false;

  const askConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  function closeDialog(result) {
    if (dialog?.resolve) dialog.resolve(result);
    setDialog(null);
  }

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 3000);
  }, []);

  const loadProfile = useCallback(async (userId) => {
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
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
          supabase
            .from("modalities")
            .select("id, name, default_monthly_value, is_active")
            .eq("is_active", true)
            .order("name"),
          supabase.from("guardians").select("id, full_name, email, phone, notes").order("full_name"),
          supabase
            .from("student_enrollments")
            .select(
              "*, student:students(*, guardian:guardians(id, full_name, email, phone)), modality:modalities(id, name, default_monthly_value)",
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("payment_statuses")
            .select("enrollment_id, reference_month, paid_at")
            .eq("reference_month", selectedReference),
        ];

        if (shouldLoadPayments) {
          const chartStart = monthsAgoStart(12);
          const paymentsFrom = debouncedReportStart < chartStart ? debouncedReportStart : chartStart;
          const paymentsTo = debouncedReportEnd > localDate() ? debouncedReportEnd : localDate();
          requests.push(
            supabase
              .from("payments")
              .select(
                "*, payer:guardians(id, full_name, email, phone), registered_by_profile:profiles!payments_registered_by_fkey(id, email, full_name), items:payment_items(*, enrollment:student_enrollments(id, monthly_value, student:students(id, full_name), modality:modalities(id, name)))",
              )
              .gte("paid_at", paymentsFrom)
              .lte("paid_at", paymentsTo)
              .order("paid_at", { ascending: false }),
            supabase.from("profiles").select("*").order("created_at"),
          );
        }

        const [
          modalitiesResult,
          guardiansResult,
          enrollmentsResult,
          statusesResult,
          paymentsResult,
          profilesResult,
        ] = await Promise.all(requests);

        for (const result of [
          modalitiesResult,
          guardiansResult,
          enrollmentsResult,
          statusesResult,
          paymentsResult,
          profilesResult,
        ]) {
          if (result?.error) throw result.error;
        }

        const loadedPayments = paymentsResult?.data || [];
        const periodPayments = loadedPayments.filter(
          (payment) => payment.paid_at >= debouncedReportStart && payment.paid_at <= debouncedReportEnd,
        );
        // Aluno excluído / modalidade removida somem das listas, mas o histórico fica.
        const visibleEnrollments = (enrollmentsResult.data || []).filter(
          (enrollment) => !enrollment.archived_at && !enrollment.student?.deleted_at,
        );

        setData({
          modalities: modalitiesResult.data || [],
          guardians: guardiansResult.data || [],
          enrollments: visibleEnrollments,
          paymentStatuses: statusesResult.data || [],
          payments: periodPayments,
          chartPayments: loadedPayments,
          profiles: profilesResult?.data || [],
        });
      } catch (requestError) {
        setError(translateError(requestError));
      } finally {
        setAppLoading(false);
      }
    },
    [month, profile?.role, debouncedReportEnd, debouncedReportStart, session?.user],
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
        setData(emptyData);
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
      setError(translateError(profileError));
    });
  }, [loadProfile, session?.user]);

  useEffect(() => {
    if (session?.user && profile?.role) {
      loadData(profile.role);
    }
  }, [loadData, profile?.role, session?.user]);

  const statusByEnrollment = useMemo(() => {
    return new Map(data.paymentStatuses.map((status) => [status.enrollment_id, status]));
  }, [data.paymentStatuses]);

  const enrichedEnrollments = useMemo(() => {
    return data.enrollments
      .map((enrollment) => {
        const paymentStatus = statusByEnrollment.get(enrollment.id);
        const status = getPaymentStatus(enrollment, paymentStatus, month);
        const student = enrollment.student || {};
        const guardian = student.guardian || null;

        return {
          ...enrollment,
          student,
          guardian,
          studentName: student.full_name || "Aluno sem nome",
          guardianName: guardian?.full_name || "Sem responsável",
          contact: student.phone || guardian?.phone || "",
          modalityName: enrollment.modality?.name || "Sem modalidade",
          paymentStatus,
          paymentStatusKey: status.key,
          paymentStatusLabel: status.label,
          paymentStatusClass: status.className,
        };
      })
      .sort((a, b) => {
        return (
          a.studentName.localeCompare(b.studentName) ||
          a.modalityName.localeCompare(b.modalityName)
        );
      });
  }, [data.enrollments, month, statusByEnrollment]);

  const groupedEnrollments = useMemo(() => {
    const groups = new Map();

    for (const enrollment of enrichedEnrollments) {
      const studentId = enrollment.student?.id || enrollment.id;
      const groupKey = String(studentId);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: `student-${groupKey}`,
          student: enrollment.student,
          guardian: enrollment.guardian,
          studentName: enrollment.studentName,
          guardianName: enrollment.guardianName,
          contact: enrollment.contact,
          dueDayCandidates: [],
          enrollmentIds: [],
          modalityIds: [],
          modalityNames: [],
          rows: [],
          totalValue: 0,
          primaryEnrollment: enrollment,
        });
      }

      const group = groups.get(groupKey);
      group.rows.push(enrollment);
      group.enrollmentIds.push(enrollment.id);
      group.totalValue += Number(enrollment.monthly_value || 0);
      if (enrollment.modality?.id && !group.modalityIds.includes(enrollment.modality.id)) {
        group.modalityIds.push(enrollment.modality.id);
      }
      if (enrollment.modalityName && !group.modalityNames.includes(enrollment.modalityName)) {
        group.modalityNames.push(enrollment.modalityName);
      }
      if (enrollment.status === "active") {
        group.dueDayCandidates.push(Number(enrollment.due_day));
      }
    }

    return Array.from(groups.values())
      .map((group) => {
        const summaryStatus = getGroupedPaymentStatus(group.rows);
        const fallbackDueDay = Number(group.primaryEnrollment?.due_day || 10);
        const activeDueDay = group.dueDayCandidates
          .filter((value) => Number.isFinite(value))
          .sort((a, b) => a - b)[0];

        return {
          id: group.id,
          student: group.student,
          guardian: group.guardian,
          studentName: group.studentName,
          guardianName: group.guardianName,
          contact: group.contact,
          due_day: Number.isFinite(activeDueDay) ? activeDueDay : fallbackDueDay,
          modalityIds: group.modalityIds,
          modalityName: group.modalityNames.join(", "),
          monthly_value: Number(group.totalValue.toFixed(2)),
          paymentStatusKey: summaryStatus.key,
          paymentStatusLabel: summaryStatus.label,
          paymentStatusClass: summaryStatus.className,
          status: summaryStatus.isActive ? "active" : "paused",
          enrollmentIds: group.enrollmentIds,
          primaryEnrollment: group.primaryEnrollment,
          rows: group.rows,
        };
      })
      .sort(
        (a, b) =>
          a.studentName.localeCompare(b.studentName) ||
          a.modalityName.localeCompare(b.modalityName),
      );
  }, [enrichedEnrollments]);

  const filteredEnrollments = useMemo(() => {
    const term = normalizeText(search);

    return groupedEnrollments.filter((enrollment) => {
      const matchesSearch =
        !term ||
        normalizeText(enrollment.studentName).includes(term) ||
        normalizeText(enrollment.guardianName).includes(term) ||
        normalizeText(enrollment.guardian?.email).includes(term) ||
        normalizeText(enrollment.contact).includes(term) ||
        normalizeText(enrollment.modalityName).includes(term);
      const matchesModality =
        modalityFilter === "all" || enrollment.modalityIds?.includes(modalityFilter);
      const matchesStatus = statusFilter === "all" || enrollment.paymentStatusKey === statusFilter;

      return matchesSearch && matchesModality && matchesStatus;
    });
  }, [groupedEnrollments, modalityFilter, search, statusFilter]);

  const pendingEnrollments = useMemo(() => {
    return groupedEnrollments
      .filter((enrollment) => enrollment.status === "active" && enrollment.paymentStatusKey !== "paid")
      .sort(
        (a, b) =>
          a.due_day - b.due_day ||
          a.guardianName.localeCompare(b.guardianName) ||
          a.studentName.localeCompare(b.studentName),
      );
  }, [groupedEnrollments]);

  const paymentOptions = useMemo(() => {
    if (!selectedEnrollment) return [];

    const selectedGuardianId = selectedEnrollment.guardian?.id;
    const selectedStudentId = selectedEnrollment.student?.id;

    return enrichedEnrollments
      .filter((enrollment) => {
        const sameFamily = selectedGuardianId
          ? enrollment.guardian?.id === selectedGuardianId
          : enrollment.student?.id === selectedStudentId;
        return sameFamily && enrollment.status === "active" && enrollment.paymentStatusKey !== "paid";
      })
      .sort(
        (a, b) =>
          a.studentName.localeCompare(b.studentName) ||
          a.modalityName.localeCompare(b.modalityName),
      );
  }, [enrichedEnrollments, selectedEnrollment]);

  const totals = useMemo(() => {
    const activeEnrollments = enrichedEnrollments.filter((enrollment) => enrollment.status === "active");
    const paidEnrollments = activeEnrollments.filter((enrollment) => enrollment.paymentStatusKey === "paid");
    const lateEnrollments = activeEnrollments.filter((enrollment) => enrollment.paymentStatusKey === "late");
    const pendingValue = activeEnrollments
      .filter((enrollment) => enrollment.paymentStatusKey !== "paid")
      .reduce((sum, enrollment) => sum + Number(enrollment.monthly_value), 0);
    const today = localDate();
    const receivedToday = data.payments
      .filter((payment) => payment.paid_at === today)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const receivedPeriod = data.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      activeCount: activeEnrollments.length,
      paidCount: paidEnrollments.length,
      lateCount: lateEnrollments.length,
      pendingCount: activeEnrollments.length - paidEnrollments.length,
      pendingValue,
      receivedToday,
      receivedPeriod,
      paymentCount: data.payments.length,
    };
  }, [data.payments, enrichedEnrollments]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setView("payments");
  }

  async function resolveGuardian(form, currentGuardian = null) {
    const fullName = String(form.get("guardian_name") || "").trim();
    const email = normalizeEmail(form.get("guardian_email")) || null;
    const phone = String(form.get("guardian_phone") || "").trim() || null;
    const phoneKey = normalizePhone(phone);

    if (!fullName && !email && !phone) return null;

    // 1) Procura responsável já existente por e-mail ou telefone (normalizados).
    let existing = null;
    if (currentGuardian?.id) {
      existing = data.guardians.find((guardian) => guardian.id === currentGuardian.id) || currentGuardian;
    }
    if (!existing && email) {
      existing = data.guardians.find((guardian) => normalizeEmail(guardian.email) === email) || null;
      if (!existing) {
        const { data: found, error: findError } = await supabase
          .from("guardians")
          .select("id, full_name, email, phone")
          .ilike("email", email)
          .maybeSingle();
        if (findError) throw findError;
        existing = found;
      }
    }
    if (!existing && phoneKey.length >= 8) {
      existing = data.guardians.find((guardian) => normalizePhone(guardian.phone) === phoneKey) || null;
    }
    if (!existing && !email && !phoneKey && fullName) {
      const sameName = data.guardians.filter(
        (guardian) => normalizeText(guardian.full_name) === normalizeText(fullName),
      );
      if (sameName.length === 1) {
        const reuse = await askConfirm({
          title: "Responsável com o mesmo nome",
          message: `Já existe um responsável chamado ${sameName[0].full_name}. É a mesma pessoa?`,
          confirmLabel: "Sim, usar o existente",
          cancelLabel: "Não, cadastrar novo",
        });
        if (reuse) existing = sameName[0];
      }
    }

    if (existing) {
      // 2) Só preenche campos vazios; se algo mudou, pergunta antes de sobrescrever.
      const fillEmpty = {};
      const changes = [];
      const fields = [
        ["full_name", fullName, "nome"],
        ["email", email, "e-mail"],
        ["phone", phone, "telefone"],
      ];
      for (const [key, value, label] of fields) {
        if (!value) continue;
        const current = existing[key] || "";
        const same =
          key === "email"
            ? normalizeEmail(current) === value
            : key === "phone"
              ? normalizePhone(current) === normalizePhone(value)
              : normalizeText(current) === normalizeText(value);
        if (!current) fillEmpty[key] = value;
        else if (!same) changes.push({ key, value, label, current });
      }

      let payload = fillEmpty;
      if (changes.length) {
        const overwrite = await askConfirm({
          title: "Atualizar dados do responsável?",
          message: `${existing.full_name} já está cadastrado com ${changes
            .map((change) => `${change.label} "${change.current}"`)
            .join(", ")}. Trocar por ${changes.map((change) => `"${change.value}"`).join(", ")}?`,
          confirmLabel: "Atualizar",
          cancelLabel: "Manter como está",
        });
        if (overwrite) {
          payload = { ...fillEmpty, ...Object.fromEntries(changes.map((change) => [change.key, change.value])) };
        }
      }

      if (Object.keys(payload).length) {
        const { error: updateError } = await supabase.from("guardians").update(payload).eq("id", existing.id);
        if (updateError) throw updateError;
      }
      return existing.id;
    }

    const { data: insertedGuardian, error: insertError } = await supabase
      .from("guardians")
      .insert({
        full_name: fullName || email || phone,
        email,
        phone,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return insertedGuardian.id;
  }

  async function handleAddEnrollment(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const modalityIds = form.getAll("modality_ids").filter(Boolean);

    if (!modalityIds.length) {
      setError("Selecione pelo menos uma modalidade.");
      return;
    }

    try {
      const guardianId = await resolveGuardian(form);
      const studentPayload = {
        guardian_id: guardianId,
        full_name: String(form.get("full_name")).trim(),
        phone: String(form.get("phone")).trim() || null,
      };

      const { data: insertedStudent, error: studentError } = await supabase
        .from("students")
        .insert(studentPayload)
        .select("id")
        .single();

      if (studentError) throw studentError;

      const dueDay = Number(form.get("due_day"));
      const notes = String(form.get("notes")).trim() || null;
      const enrollmentPayloads = modalityIds.map((modalityId) => ({
        student_id: insertedStudent.id,
        modality_id: modalityId,
        monthly_value: Number(form.get(`monthly_value_${modalityId}`)),
        due_day: dueDay,
        notes,
        status: "active",
      }));

      const { error: enrollmentError } = await supabase
        .from("student_enrollments")
        .insert(enrollmentPayloads);

      if (enrollmentError) throw enrollmentError;

      formElement.reset();
      showToast("Cadastro salvo.");
      loadData();
    } catch (requestError) {
      setError(translateError(requestError));
    }
  }

  async function handleUpdateEnrollment(event, rows) {
    event.preventDefault();
    if (!editingEnrollment) return;

    const form = new FormData(event.currentTarget);
    const activeRows = rows.filter((row) => !row.removed);

    if (!activeRows.length) {
      setError("O aluno precisa ter pelo menos uma modalidade. Para tirar o aluno, use Excluir aluno.");
      return;
    }
    if (activeRows.some((row) => !row.modality_id)) {
      setError("Escolha a modalidade de todas as linhas.");
      return;
    }
    const modalityKeys = activeRows.map((row) => row.modality_id);
    if (new Set(modalityKeys).size !== modalityKeys.length) {
      setError("A mesma modalidade aparece duas vezes para esse aluno.");
      return;
    }
    if (activeRows.some((row) => !(Number(row.due_day) >= 1 && Number(row.due_day) <= 31))) {
      setError("O vencimento precisa ser um dia entre 1 e 31.");
      return;
    }

    const removedRows = rows.filter((row) => row.removed && row.id);
    if (removedRows.length) {
      const ok = await askConfirm({
        title: "Remover modalidade?",
        message: `${removedRows.length === 1 ? "A modalidade" : "As modalidades"} ${removedRows
          .map((row) => row.modalityName || "selecionada")
          .join(", ")} ${removedRows.length === 1 ? "sai" : "saem"} do cadastro. Os pagamentos já lançados continuam no histórico e nos relatórios.`,
        confirmLabel: "Remover",
        danger: true,
      });
      if (!ok) return;
    }

    try {
      const guardianId = await resolveGuardian(form, editingEnrollment.guardian);
      const studentId = editingEnrollment.student.id;
      const { error: studentError } = await supabase
        .from("students")
        .update({
          guardian_id: guardianId,
          full_name: String(form.get("full_name")).trim(),
          phone: String(form.get("phone")).trim() || null,
        })
        .eq("id", studentId);

      if (studentError) throw studentError;

      for (const row of rows) {
        if (row.removed) {
          if (!row.id) continue;
          // Nunca apaga a matrícula: cancela (e arquiva, se o banco já tiver suporte).
          const archivePayload = hasHistorySchema
            ? { status: "cancelled", archived_at: new Date().toISOString() }
            : { status: "cancelled" };
          const { error: archiveError } = await supabase
            .from("student_enrollments")
            .update(archivePayload)
            .eq("id", row.id);
          if (archiveError) throw archiveError;
          continue;
        }

        const payload = {
          modality_id: row.modality_id,
          monthly_value: Number(row.monthly_value || 0),
          due_day: Number(row.due_day),
          status: row.status,
          notes: String(row.notes || "").trim() || null,
        };

        const { error: rowError } = row.id
          ? await supabase.from("student_enrollments").update(payload).eq("id", row.id)
          : await supabase.from("student_enrollments").insert({ ...payload, student_id: studentId });
        if (rowError) throw rowError;
      }

      setEditingEnrollment(null);
      showToast("Cadastro atualizado.");
      loadData();
    } catch (requestError) {
      setError(translateError(requestError));
      loadData();
    }
  }

  async function handlePayment(event) {
    event.preventDefault();
    if (!selectedEnrollment) return;

    const form = new FormData(event.currentTarget);
    const nextMonth = String(form.get("reference_month"));
    const enrollmentIds = form.getAll("enrollment_ids").map(String);

    if (!enrollmentIds.length) {
      setError("Selecione pelo menos uma matrícula para dar baixa.");
      return;
    }

    const selectedItems = enrollmentIds
      .map((id) => enrichedEnrollments.find((enrollment) => enrollment.id === id))
      .filter(Boolean);

    const amount = Number(form.get("amount"));
    const note = String(form.get("note")).trim() || null;
    const expected = sumEnrollments(selectedItems);

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Informe um valor válido.");
      return;
    }
    if ((amount === 0 && expected > 0) || amount < expected - 0.001) {
      if (!note) {
        setError(
          `O valor (${formatMoney(amount)}) está abaixo da mensalidade (${formatMoney(expected)}). Explique na observação: desconto, bolsa, pagamento parcial...`,
        );
        return;
      }
    }

    const itemAmounts = allocatePaymentItems(amount, selectedItems);

    const { error: paymentError } = await supabase.rpc("record_payment", {
      p_reference_month: referenceDate(nextMonth),
      p_paid_at: form.get("paid_at"),
      p_amount: amount,
      p_method: form.get("method"),
      p_note: note,
      p_payer_guardian_id: selectedEnrollment.guardian?.id || null,
      p_items: itemAmounts,
    });

    if (paymentError) {
      setError(translateError(paymentError));
      return;
    }

    setMonth(nextMonth);
    setSelectedEnrollment(null);
    setPaymentOrigin(null);
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
    const amount = Number(form.get("amount"));
    const note = String(form.get("note")).trim() || null;

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (amount === 0 && !note) {
      setError("Pagamento de R$ 0,00 precisa de uma observação (ex.: bolsa).");
      return;
    }

    const itemEnrollments = (editingPayment.items || []).map((item) => ({
      id: item.id,
      monthly_value: item.enrollment?.monthly_value || item.amount,
    }));
    const itemAmounts = allocatePaymentItems(amount, itemEnrollments).map((item) => ({
      id: item.enrollment_id,
      amount: item.amount,
    }));

    if (hasHistorySchema) {
      // Tudo numa transação só no banco: ou salva tudo, ou nada.
      const { error: rpcError } = await supabase.rpc("update_payment", {
        p_payment_id: editingPayment.id,
        p_reference_month: referenceDate(nextReferenceMonth),
        p_paid_at: form.get("paid_at"),
        p_amount: amount,
        p_method: form.get("method"),
        p_note: note,
        p_items: itemAmounts,
      });
      if (rpcError) {
        setError(translateError(rpcError));
        return;
      }
    } else {
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          reference_month: referenceDate(nextReferenceMonth),
          paid_at: form.get("paid_at"),
          amount,
          method: form.get("method"),
          note,
        })
        .eq("id", editingPayment.id);

      if (updateError) {
        setError(translateError(updateError));
        return;
      }

      const itemUpdates = await Promise.all(
        itemAmounts.map((item) =>
          supabase
            .from("payment_items")
            .update({ reference_month: referenceDate(nextReferenceMonth), amount: item.amount })
            .eq("id", item.id),
        ),
      );

      const itemError = itemUpdates.find((result) => result.error)?.error;
      if (itemError) {
        setError(
          itemError.code === "23505"
            ? "Uma das matrículas já tem pagamento lançado nesse mês."
            : translateError(itemError),
        );
        loadData();
        return;
      }
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
    if (hasHistorySchema && profileId !== session.user.id) {
      payload.approved = form.get("approved") === "true";
    }

    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", profileId);

    if (updateError) {
      setError(translateError(updateError));
      return;
    }

    showToast("Usuário atualizado.");
    loadData();
    if (profileId === session.user.id) {
      loadProfile(profileId);
    }
  }

  async function handleApproveProfile(user, approved) {
    const { error: updateError } = await supabase.from("profiles").update({ approved }).eq("id", user.id);
    if (updateError) {
      setError(translateError(updateError));
      return;
    }
    showToast(approved ? "Acesso liberado." : "Acesso bloqueado.");
    loadData();
  }

  async function handleEnrollmentStatus(enrollment) {
    if (!enrollment?.id) {
      setError("Matrícula inválida para atualizar o status.");
      return;
    }

    const nextStatus = enrollment.status === "active" ? "paused" : "active";
    const { error: updateError } = await supabase
      .from("student_enrollments")
      .update({ status: nextStatus })
      .eq("id", enrollment.id);

    if (updateError) {
      setError(translateError(updateError));
      return;
    }

    showToast(
      `${enrollment.modalityName || "Matrícula"} ${nextStatus === "active" ? "ativada" : "pausada"}.`,
    );
    loadData();
  }

  async function handleDeleteStudent(enrollment) {
    const studentId = enrollment?.student?.id;
    const studentName = enrollment?.studentName || enrollment?.student?.full_name || "este aluno";

    if (!studentId) {
      setError("Aluno inválido para exclusão.");
      return;
    }

    if (!hasHistorySchema) {
      setError(
        "A exclusão de alunos está temporariamente desativada até a atualização do banco ser aplicada (assim nenhum pagamento antigo é perdido). Por enquanto, use Pausar.",
      );
      return;
    }

    const ok = await askConfirm({
      title: `Excluir ${studentName}?`,
      message:
        "O aluno sai das listas e das pendências. Os pagamentos já feitos e os valores continuam no histórico e nos relatórios.",
      confirmLabel: "Excluir aluno",
      danger: true,
    });
    if (!ok) return;

    const { error: deleteError } = await supabase.rpc("archive_student", { p_student_id: studentId });

    if (deleteError) {
      setError(translateError(deleteError));
      return;
    }

    if (editingEnrollment?.student?.id === studentId) {
      setEditingEnrollment(null);
    }
    if (selectedEnrollment?.student?.id === studentId) {
      setSelectedEnrollment(null);
      setPaymentOrigin(null);
    }

    showToast("Aluno excluído. O histórico de pagamentos foi mantido.");
    loadData();
  }

  async function handleDeletePayment(paymentId) {
    const ok = await askConfirm({
      title: "Estornar pagamento?",
      message: "A baixa é desfeita e a mensalidade volta a aparecer como pendente.",
      confirmLabel: "Estornar",
      danger: true,
    });
    if (!ok) return;

    const { error: deleteError } = await supabase.from("payments").delete().eq("id", paymentId);

    if (deleteError) {
      setError(translateError(deleteError));
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

  if (isPendingApproval) {
    return <PendingApprovalScreen email={session.user.email} onSignOut={handleSignOut} />;
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
            Cadastros
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
          <span className="role-pill">{isAdmin ? "Administrador" : "Funcionário"}</span>
          {isAdmin && hasHistorySchema && data.profiles.some((user) => user.approved === false) && (
            <button className="pending-users-pill" onClick={() => setView("users")}>
              {data.profiles.filter((user) => user.approved === false).length} conta(s) aguardando aprovação
            </button>
          )}
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
              {monthLabel(month)} — {isAdmin ? "visão completa" : "visão operacional"}
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
                  setSelectedEnrollment(null);
                  setPaymentOrigin(null);
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
            filteredEnrollments={filteredEnrollments}
            isAdmin={isAdmin}
            month={month}
            paymentOptions={paymentOptions}
            paymentOrigin={paymentOrigin}
            paymentPanelRef={paymentPanelRef}
            profile={profile}
            selectedEnrollment={selectedEnrollment}
            setModalityFilter={setModalityFilter}
            setSearch={setSearch}
            setSelectedEnrollment={(enrollment) => {
              setSelectedEnrollment(enrollment);
              setPaymentOrigin(null);
            }}
            clearPaymentSelection={({ goBack } = {}) => {
              const fromPending = paymentOrigin === "pending";
              setSelectedEnrollment(null);
              setPaymentOrigin(null);
              if (goBack || fromPending) setView("pending");
            }}
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
            pendingEnrollments={pendingEnrollments}
            totals={totals}
            onSelectEnrollment={(enrollment) => {
              setSelectedEnrollment(enrollment);
              setPaymentOrigin("pending");
              setView("payments");
            }}
          />
        )}

        {view === "students" && (
          <StudentsView
            data={data}
            editingEnrollment={editingEnrollment}
            filteredEnrollments={filteredEnrollments}
            isAdmin={isAdmin}
            modalityFilter={modalityFilter}
            search={search}
            setEditingEnrollment={setEditingEnrollment}
            setModalityFilter={setModalityFilter}
            setSearch={setSearch}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
            onAddEnrollment={handleAddEnrollment}
            onCancelEdit={() => setEditingEnrollment(null)}
            onUpdateEnrollment={handleUpdateEnrollment}
            hasHistorySchema={hasHistorySchema}
            onEnrollmentStatus={handleEnrollmentStatus}
            onDeleteStudent={handleDeleteStudent}
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
            hasHistorySchema={hasHistorySchema}
            onApproveProfile={handleApproveProfile}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </main>

      {dialog && <ConfirmDialog dialog={dialog} onClose={closeDialog} />}

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
        <p>Verificando sua sessão...</p>
      </section>
    </main>
  );
}

function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const response = await supabase.auth.signInWithPassword({ email, password });

    if (response.error) {
      setMessage(translateError(response.error));
    }

    setLoading(false);
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-mark dark">{icons.music}</span>
        <h1>Mensalidades</h1>
        <p>Acesso restrito à equipe da escola.</p>

        <form onSubmit={handleAuth} className="auth-form">
          <label className="field">
            <span>E-mail</span>
            <input name="email" type="email" required autoComplete="email" placeholder="email@exemplo.com" />
          </label>

          <label className="field">
            <span>Senha</span>
            <input name="password" type="password" minLength="6" required autoComplete="current-password" placeholder="Sua senha" />
          </label>

          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}

          <button className="button primary full" disabled={loading}>
            {loading ? "Aguarde..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function PendingApprovalScreen({ email, onSignOut }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-mark dark">{icons.lock}</span>
        <h1>Aguardando aprovação</h1>
        <p>
          Sua conta ({email}) foi criada, mas ainda precisa ser liberada por um administrador da escola.
          Assim que ela for aprovada, é só entrar de novo.
        </p>
        <button className="button secondary full" onClick={onSignOut}>
          Sair
        </button>
      </section>
    </main>
  );
}

function ConfirmDialog({ dialog, onClose }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => onClose(false)}>
      <section
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">{dialog.title}</h2>
        {dialog.message && <p id="confirm-text">{dialog.message}</p>}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={() => onClose(false)}>
            {dialog.cancelLabel || "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            className={`button ${dialog.danger ? "danger" : "primary"}`}
            type="button"
            onClick={() => onClose(true)}
          >
            {dialog.confirmLabel || "Confirmar"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PaymentsView(props) {
  const fromPending = props.paymentOrigin === "pending" && props.selectedEnrollment;
  const studentLabel =
    props.selectedEnrollment?.studentName ||
    props.selectedEnrollment?.student?.full_name ||
    "aluno";

  useEffect(() => {
    if (!props.selectedEnrollment || !props.paymentPanelRef?.current) return;
    const panel = props.paymentPanelRef.current;
    const timer = window.setTimeout(() => {
      const rect = panel.getBoundingClientRect();
      const isSmallScreen = window.matchMedia("(max-width: 1080px)").matches;
      const outOfView = rect.top < 0 || rect.top > window.innerHeight * 0.6;
      if (props.paymentOrigin !== "pending" && !isSmallScreen && !outOfView) return;
      panel.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      const focusable = panel.querySelector("input, select, textarea, button");
      if (focusable) focusable.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [props.selectedEnrollment?.id, props.paymentOrigin, props.paymentPanelRef]);

  return (
    <>
      <MetricGrid totals={props.totals} isAdmin={props.isAdmin} />
      {fromPending && (
        <div className="context-banner" role="status">
          <div>
            <strong>Baixa de {studentLabel}</strong>
            <span>Vindo de Pendências — confirme o pagamento abaixo.</span>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => props.clearPaymentSelection({ goBack: true })}
          >
            Cancelar
          </button>
        </div>
      )}
      <section className="split-grid">
        <div>
          <EnrollmentFilters {...props} />
          <EnrollmentTable
            enrollments={props.filteredEnrollments}
            context="payments"
            month={props.month}
            isAdmin={props.isAdmin}
            onSelect={props.setSelectedEnrollment}
          />
        </div>
        <aside className="panel sticky-panel" ref={props.paymentPanelRef}>
          <div className="panel-header">
            <div>
              <h2>{fromPending ? "Dar baixa" : "Registrar pagamento"}</h2>
              <p>
                {fromPending
                  ? `Baixa de ${studentLabel} — marque as matrículas e confirme.`
                  : "Selecione uma pendência e marque todas as matrículas pagas junto."}
              </p>
            </div>
          </div>
          <div className="panel-body">
            {props.selectedEnrollment ? (
              <PaymentForm
                availableEnrollments={props.paymentOptions}
                enrollment={props.selectedEnrollment}
                month={props.month}
                profile={props.profile}
                onCancel={() => props.clearPaymentSelection()}
                onSubmit={props.onPayment}
              />
            ) : (
              <EmptyState
                title="Nenhum cadastro selecionado"
                text="Clique em Dar baixa para preencher o pagamento."
              />
            )}
          </div>
        </aside>
      </section>
    </>
  );
}

function PendingView({ isAdmin, month, pendingEnrollments, totals, onSelectEnrollment }) {
  const today = localDate();
  const dueTodayCount = pendingEnrollments.filter(
    (enrollment) => dueDateFor(month, enrollment.due_day) === today,
  ).length;

  return (
    <>
      <section className={`metric-grid ${isAdmin ? "" : "metric-grid-staff"}`.trim()} aria-label="Resumo de pendências">
        <Metric label="Pendentes" value={totals.pendingCount} detail="Ainda sem baixa no mês" icon={icons.clock} />
        <Metric label="Atrasados" value={totals.lateCount} detail="Vencimento já passou" icon={icons.wallet} />
        <Metric label="Vencem hoje" value={dueTodayCount} detail="Precisam de acompanhamento" icon={icons.check} />
        {isAdmin ? (
          <Metric
            label="Valor em aberto"
            value={formatMoney(totals.pendingValue)}
            detail="Estimativa das mensalidades"
            icon={icons.users}
          />
        ) : (
          <Metric
            label="Matrículas ativas"
            value={totals.activeCount}
            detail="Alunos e modalidades"
            icon={icons.users}
          />
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Pendências do mês</h2>
            <p>Matrículas ativas sem pagamento lançado em {monthLabel(month)}.</p>
          </div>
        </div>
        <PendingTable enrollments={pendingEnrollments} isAdmin={isAdmin} month={month} onSelectEnrollment={onSelectEnrollment} />
      </section>
    </>
  );
}

function PendingTable({ enrollments, isAdmin, month, onSelectEnrollment }) {
  if (!enrollments.length) {
    return <EmptyState title="Tudo certo por aqui" text="Não há pendências no mês selecionado." />;
  }

  return (
    <>
      <div className="table-wrap desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky-col">Aluno</th>
              <th>Responsável</th>
              <th>Modalidade</th>
              <th>Vencimento</th>
              {isAdmin && <th>Valor</th>}
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td className="sticky-col">
                  <StudentCell enrollment={enrollment} />
                </td>
                <td>
                  <GuardianCell enrollment={enrollment} />
                </td>
                <td>{enrollment.modalityName}</td>
                <td>Dia {effectiveDueDay(month, enrollment.due_day)}</td>
                {isAdmin && <td>{formatMoney(enrollment.monthly_value)}</td>}
                <td>
                  <span className={`badge ${enrollment.paymentStatusClass}`}>{enrollment.paymentStatusLabel}</span>
                </td>
                <td>
                  <button className="table-action primary" onClick={() => onSelectEnrollment(enrollment)}>
                    {icons.check}
                    Dar baixa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="list-cards mobile-only" aria-label="Pendências em cartões">
        {enrollments.map((enrollment) => (
          <article className="list-card" key={enrollment.id}>
            <div className="list-card-head">
              <div>
                <strong>{enrollment.studentName}</strong>
                <span className="list-card-meta">{enrollment.modalityName}</span>
              </div>
              <span className={`badge ${enrollment.paymentStatusClass}`}>{enrollment.paymentStatusLabel}</span>
            </div>
            <div className="list-card-body">
              <span>Resp.: {enrollment.guardianName}</span>
              <span>Vence dia {effectiveDueDay(month, enrollment.due_day)}</span>
              {isAdmin && <span>{formatMoney(enrollment.monthly_value)}</span>}
            </div>
            <div className="list-card-actions">
              <button className="table-action primary" onClick={() => onSelectEnrollment(enrollment)}>
                {icons.check}
                Dar baixa
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function StudentsView(props) {
  const isEditing = Boolean(props.editingEnrollment);

  return (
    <section className="split-grid">
      <div>
        <EnrollmentFilters {...props} />
        <p className="hint-line">Toque numa modalidade para pausar ou ativar só ela. Em Editar dá para mudar valor, vencimento ou adicionar e remover modalidades.</p>
        <EnrollmentTable
          enrollments={props.filteredEnrollments}
          context="students"
          isAdmin={props.isAdmin}
          onEditEnrollment={(group) => {
            props.setEditingEnrollment(group);
            window.setTimeout(() => {
              document.querySelector(".student-form-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 60);
          }}
          onEnrollmentStatus={props.onEnrollmentStatus}
          onDeleteStudent={props.onDeleteStudent}
        />
      </div>
      <aside className="panel sticky-panel student-form-panel">
        <div className="panel-header">
          <div>
            <h2>{isEditing ? `Editar ${props.editingEnrollment.studentName}` : "Novo cadastro"}</h2>
            <p>
              {isEditing
                ? "Atualize aluno, responsável e cada modalidade (valor, vencimento e status)."
                : "Cadastre o responsável, o aluno e uma ou mais modalidades."}
            </p>
          </div>
        </div>
        <div className="panel-body">
          <EnrollmentForm
            key={props.editingEnrollment?.id || "new-enrollment"}
            modalities={props.data.modalities}
            enrollment={props.editingEnrollment}
            onCancel={props.onCancelEdit}
            onSubmit={isEditing ? props.onUpdateEnrollment : props.onAddEnrollment}
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
  const byModality = groupPaymentItems(
    data.payments,
    (item) => item.modality_name || item.enrollment?.modality?.name || "Sem modalidade",
  );
  const byDay = groupPayments(data.payments, (payment) => formatDate(payment.paid_at));
  const chartPayments = useMemo(
    () => chartScopePayments(data.chartPayments || data.payments, 12),
    [data.chartPayments, data.payments],
  );
  const monthlyReceived = useMemo(() => buildMonthlyReceived(chartPayments, 12), [chartPayments]);
  const methodBreakdown = useMemo(() => buildMethodBreakdown(chartPayments), [chartPayments]);

  return (
    <>
      <MetricGrid totals={totals} isAdmin />
      <MonthlyReceivedChart series={monthlyReceived} methods={methodBreakdown} />
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
      <section className="split-grid report-period-charts">
        <ChartPanel title="Recebido por modalidade" values={byModality} />
        <ChartPanel title="Recebido por dia" values={byDay} />
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Histórico do período</h2>
            <p>Veja o responsável, os alunos pagos juntos e quem lançou a baixa.</p>
          </div>
        </div>
        <div className="table-wrap history-table-wrap">
          <table className="data-table history-table">
            <thead>
              <tr>
                <th className="sticky-col">Data</th>
                <th>Responsável</th>
                <th>Alunos e modalidades</th>
                <th>Forma</th>
                <th>Valor</th>
                <th>Lançado por</th>
                <th className="actions-col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length ? (
                data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="sticky-col">{formatDate(payment.paid_at)}</td>
                    <td>{paymentPayerLabel(payment)}</td>
                    <td className="report-items">{paymentItemsLabel(payment)}</td>
                    <td>{paymentMethodLabel(payment.method)}</td>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>
                      <StaffCell profile={payment.registered_by_profile} />
                    </td>
                    <td className="actions-col">
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
                  <td colSpan="7" className="muted">
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
              <p>Altere mês, data, valor, forma ou observação da baixa conjunta.</p>
            </div>
          </div>
          <div className="panel-body">
            <PaymentEditForm payment={editingPayment} onCancel={onCancelPaymentEdit} onSubmit={onUpdatePayment} />
          </div>
        </section>
      )}
    </>
  );
}

function UsersView({ currentUserId, hasHistorySchema, profiles, onApproveProfile, onUpdateProfile }) {
  const pending = hasHistorySchema ? profiles.filter((user) => user.approved === false) : [];
  const others = hasHistorySchema ? profiles.filter((user) => user.approved !== false) : profiles;

  return (
    <>
      {pending.length > 0 && (
        <section className="panel approval-panel">
          <div className="panel-header">
            <div>
              <h2>Aguardando aprovação</h2>
              <p>Contas novas não veem nenhum dado até você liberar.</p>
            </div>
          </div>
          <div className="panel-body user-grid">
            {pending.map((user) => (
              <article className="user-card pending" key={user.id}>
                <div className="user-card-id">
                  <strong>{user.full_name || "Sem nome"}</strong>
                  <span>{user.email || user.id}</span>
                  <small>Criada em {formatDate(String(user.created_at || "").slice(0, 10))}</small>
                </div>
                <div className="user-card-actions">
                  <button className="button primary" onClick={() => onApproveProfile(user, true)}>
                    {icons.check} Aprovar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Usuários e permissões</h2>
            <p>Defina quem é administrador, quem é funcionário e quem tem acesso.</p>
          </div>
        </div>
        <div className="panel-body user-grid">
          {others.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <form className="user-card" key={user.id} onSubmit={(event) => onUpdateProfile(event, user.id)}>
                <label className="field">
                  <span>Nome</span>
                  <input name="full_name" defaultValue={user.full_name} placeholder="Nome do usuário" />
                </label>
                <div className="user-card-email">
                  <span>E-mail</span>
                  <strong>{user.email || user.id}</strong>
                </div>
                <label className="field">
                  <span>Perfil</span>
                  <select name="role" defaultValue={user.role} disabled={isSelf}>
                    <option value="staff">Funcionário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
                {hasHistorySchema && (
                  <label className="field">
                    <span>Acesso</span>
                    <select name="approved" defaultValue={user.approved === false ? "false" : "true"} disabled={isSelf}>
                      <option value="true">Liberado</option>
                      <option value="false">Bloqueado</option>
                    </select>
                  </label>
                )}
                <div className="user-card-actions">
                  {isSelf ? (
                    <span className="muted">Este é você</span>
                  ) : (
                    <button className="button primary">Salvar</button>
                  )}
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </>
  );
}

function EnrollmentFilters({
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
          <h2>Cadastros e situação</h2>
          <p>Filtre por aluno, responsável, e-mail, telefone, modalidade ou status.</p>
        </div>
      </div>
      <div className="panel-body search-box">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          type="search"
          placeholder="Buscar aluno, responsável, e-mail ou modalidade"
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

function EnrollmentTable({
  enrollments,
  context,
  isAdmin = false,
  onDeleteStudent,
  onEditEnrollment,
  onSelect,
  onEnrollmentStatus,
  month = currentMonth(),
}) {
  if (!enrollments.length) {
    return <EmptyState title="Nenhum cadastro encontrado" text="Altere os filtros ou cadastre um novo aluno." />;
  }

  // Staff: hide money overview on payments/pending tables; Cadastros still shows values for editing.
  const showMensalidade = isAdmin || context === "students";

  function renderModalities(enrollment) {
    const rows = enrollment.rows || [];
    if (context !== "students" || !rows.length) return enrollment.modalityName;
    return (
      <span className="modality-chips">
        {rows.map((row) => {
          const active = row.status === "active";
          return (
            <button
              type="button"
              key={row.id}
              className={`modality-chip ${active ? "is-active" : "is-paused"}`}
              title={active ? `Clique para pausar ${row.modalityName}` : `Clique para ativar ${row.modalityName}`}
              aria-label={`${row.modalityName}: ${active ? "ativa, clique para pausar" : "pausada, clique para ativar"}`}
              onClick={() => onEnrollmentStatus(row)}
            >
              <span className="chip-dot" aria-hidden="true" />
              {row.modalityName}
              <small>{active ? "Ativa" : row.status === "cancelled" ? "Cancelada" : "Pausada"}</small>
            </button>
          );
        })}
      </span>
    );
  }

  function renderActions(enrollment) {
    const canPay = enrollment.paymentStatusKey === "pending" || enrollment.paymentStatusKey === "late";

    if (context === "payments") {
      if (canPay) {
        return (
          <button className="table-action primary" onClick={() => onSelect(enrollment)}>
            {icons.check}
            Dar baixa
          </button>
        );
      }
      return (
        <span className="muted">
          {enrollment.paymentStatus?.paid_at
            ? `Pago em ${formatDate(enrollment.paymentStatus.paid_at)}`
            : "Sem ação"}
        </span>
      );
    }

    return (
      <span className="table-actions">
        <button className="table-action secondary" onClick={() => onEditEnrollment(enrollment)}>
          Editar
        </button>
        <button className="table-action danger" onClick={() => onDeleteStudent(enrollment)}>
          {icons.trash}
          Excluir aluno
        </button>
      </span>
    );
  }

  return (
    <section className="panel">
      <div className="table-wrap desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky-col">Aluno</th>
              <th>Responsável</th>
              <th>Modalidade</th>
              <th>Vencimento</th>
              {showMensalidade && <th>Mensalidade</th>}
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td className="sticky-col">
                  <StudentCell enrollment={enrollment} />
                </td>
                <td>
                  <GuardianCell enrollment={enrollment} />
                </td>
                <td>{renderModalities(enrollment)}</td>
                <td>Dia {effectiveDueDay(month, enrollment.due_day)}</td>
                {showMensalidade && <td>{formatMoney(enrollment.monthly_value)}</td>}
                <td>
                  <span className={`badge ${enrollment.paymentStatusClass}`}>{enrollment.paymentStatusLabel}</span>
                </td>
                <td>{renderActions(enrollment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="list-cards mobile-only" aria-label={context === "payments" ? "Pagamentos em cartões" : "Cadastros em cartões"}>
        {enrollments.map((enrollment) => (
          <article className="list-card" key={enrollment.id}>
            <div className="list-card-head">
              <div>
                <strong>{enrollment.studentName}</strong>
                {context !== "students" && <span className="list-card-meta">{enrollment.modalityName}</span>}
              </div>
              <span className={`badge ${enrollment.paymentStatusClass}`}>{enrollment.paymentStatusLabel}</span>
            </div>
            {context === "students" && <div className="list-card-chips">{renderModalities(enrollment)}</div>}
            <div className="list-card-body">
              <span>Resp.: {enrollment.guardianName}</span>
              <span>Vence dia {effectiveDueDay(month, enrollment.due_day)}</span>
              {showMensalidade && <span>{formatMoney(enrollment.monthly_value)}</span>}
            </div>
            <div className="list-card-actions">{renderActions(enrollment)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}


function MetricGrid({ totals, isAdmin }) {
  if (isAdmin) {
    return (
      <section className="metric-grid" aria-label="Resumo financeiro">
        <Metric label="Recebido hoje" value={formatMoney(totals.receivedToday)} detail="Pagamentos de hoje" icon={icons.wallet} />
        <Metric label="Recebido no período" value={formatMoney(totals.receivedPeriod)} detail={`${totals.paymentCount} pagamentos`} icon={icons.chart} />
        <Metric label="Pendência estimada" value={formatMoney(totals.pendingValue)} detail="Matrículas não pagas" icon={icons.clock} />
        <Metric label="Matrículas ativas" value={totals.activeCount} detail={`${totals.lateCount} atrasadas`} icon={icons.users} />
      </section>
    );
  }

  return (
    <section className="metric-grid metric-grid-staff" aria-label="Resumo operacional">
      <Metric label="Pagas" value={totals.paidCount} detail="No mês selecionado" icon={icons.check} />
      <Metric label="Pendentes" value={totals.pendingCount} detail="Ainda precisam de baixa" icon={icons.clock} />
      <Metric label="Atrasadas" value={totals.lateCount} detail="Vencimento já passou" icon={icons.wallet} />
      <Metric label="Matrículas ativas" value={totals.activeCount} detail="Alunos e modalidades" icon={icons.users} />
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

function PaymentForm({ availableEnrollments, enrollment, month, onCancel, onSubmit, profile }) {
  const optionKey = availableEnrollments.map((item) => item.id).join("|");
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedEnrollments = availableEnrollments.filter((item) => selectedIds.includes(item.id));
  const selectedTotal = selectedEnrollments.reduce((sum, item) => sum + Number(item.monthly_value), 0);
  const [amount, setAmount] = useState("0.00");

  useEffect(() => {
    const nextIds = availableEnrollments.map((item) => item.id);
    setSelectedIds(nextIds);
    setAmount(sumEnrollments(availableEnrollments).toFixed(2));
  }, [enrollment.id, optionKey]);

  useEffect(() => {
    setAmount(selectedTotal.toFixed(2));
  }, [selectedIds.join("|")]);

  function toggleEnrollment(id) {
    setSelectedIds((currentIds) =>
      currentIds.includes(id) ? currentIds.filter((currentId) => currentId !== id) : [...currentIds, id],
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="selected-student">
        <strong>{enrollment.guardian?.full_name || enrollment.studentName}</strong>
        <span>{enrollment.guardian?.email || enrollment.contact || "Responsável sem contato"}</span>
        <small>Lançado por {profileLabel(profile)}</small>
      </div>

      <div className="payment-options">
        {availableEnrollments.map((item) => (
          <label className="item-check" key={item.id}>
            <input
              name="enrollment_ids"
              type="checkbox"
              value={item.id}
              checked={selectedIds.includes(item.id)}
              onChange={() => toggleEnrollment(item.id)}
            />
            <span>
              <strong>{item.studentName}</strong>
              <small>
                {item.modalityName} - {formatMoney(item.monthly_value)}
              </small>
            </span>
          </label>
        ))}
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
          <span>Valor total</span>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
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

      <div className="payment-summary">
        <span>{selectedEnrollments.length} matrícula(s) selecionada(s)</span>
        <strong>{formatMoney(amount)}</strong>
      </div>

      <div className="button-row form-actions payment-form-actions">
        <button className="button primary" disabled={!selectedIds.length}>
          {icons.check} Confirmar baixa
        </button>
        <button className="button secondary cancel-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PaymentEditForm({ onCancel, onSubmit, payment }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="selected-student">
        <strong>{paymentPayerLabel(payment)}</strong>
        <span>{paymentItemsLabel(payment)}</span>
        <small>Lançado por {profileLabel(payment.registered_by_profile)}</small>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Referente</span>
          <input name="reference_month" type="month" defaultValue={monthFromDate(payment.reference_month)} required />
        </label>
        <label className="field">
          <span>Pago em</span>
          <input name="paid_at" type="date" defaultValue={payment.paid_at} required />
        </label>
        <label className="field">
          <span>Valor total</span>
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
        <button className="button secondary cancel-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function EnrollmentForm({ modalities, onCancel, onSubmit, enrollment }) {
  const isEditing = Boolean(enrollment);
  const guardian = enrollment?.guardian;
  const student = enrollment?.student;
  const [rows, setRows] = useState(() =>
    (enrollment?.rows || (enrollment ? [enrollment] : [])).map((row) => ({
      key: row.id,
      id: row.id,
      modality_id: row.modality?.id || row.modality_id || "",
      modalityName: row.modalityName || row.modality?.name || "",
      monthly_value: row.monthly_value ?? "0",
      due_day: row.due_day ?? 10,
      status: row.status || "active",
      notes: row.notes || "",
      removed: false,
    })),
  );

  function updateRow(key, patch) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const used = new Set(rows.filter((row) => !row.removed).map((row) => row.modality_id));
    const next = modalities.find((modality) => !used.has(modality.id));
    setRows((current) => [
      ...current,
      {
        key: `new-${Date.now()}`,
        id: null,
        modality_id: next?.id || "",
        modalityName: next?.name || "",
        monthly_value: next?.default_monthly_value ?? "0",
        due_day: current.find((row) => !row.removed)?.due_day ?? 10,
        status: "active",
        notes: "",
        removed: false,
      },
    ]);
  }

  const modalityOptions = useMemo(() => {
    const list = [...modalities];
    for (const row of rows) {
      if (row.modality_id && !list.some((modality) => modality.id === row.modality_id)) {
        list.push({ id: row.modality_id, name: row.modalityName || "Modalidade inativa", default_monthly_value: 0 });
      }
    }
    return list;
  }, [modalities, rows]);

  return (
    <form onSubmit={(event) => (isEditing ? onSubmit(event, rows) : onSubmit(event))}>
      <div className="form-grid">
        <label className="field wide">
          <span>Aluno</span>
          <input name="full_name" required placeholder="Nome do aluno" defaultValue={student?.full_name || ""} />
        </label>
        <label className="field">
          <span>Telefone do aluno</span>
          <input name="phone" placeholder="(00) 00000-0000" defaultValue={student?.phone || ""} />
        </label>
        <label className="field">
          <span>Responsável</span>
          <input name="guardian_name" placeholder="Nome do responsável" defaultValue={guardian?.full_name || ""} />
        </label>
        <label className="field">
          <span>E-mail do responsável</span>
          <input name="guardian_email" type="email" placeholder="responsavel@email.com" defaultValue={guardian?.email || ""} />
        </label>
        <label className="field">
          <span>Telefone do responsável</span>
          <input name="guardian_phone" placeholder="(00) 00000-0000" defaultValue={guardian?.phone || ""} />
        </label>

        {isEditing ? (
          <fieldset className="field wide enrollment-rows">
            <legend>Modalidades do aluno</legend>
            {rows.map((row) =>
              row.removed ? (
                <div className="enrollment-row removed" key={row.key}>
                  <span>
                    <strong>{row.modalityName || "Modalidade"}</strong> será removida (o histórico fica).
                  </span>
                  <button type="button" className="table-action secondary" onClick={() => updateRow(row.key, { removed: false })}>
                    Desfazer
                  </button>
                </div>
              ) : (
                <div className={`enrollment-row status-${row.status}`} key={row.key}>
                  <label className="field">
                    <span>Modalidade</span>
                    <select
                      value={row.modality_id}
                      required
                      onChange={(event) => {
                        const modality = modalityOptions.find((item) => item.id === event.target.value);
                        updateRow(row.key, {
                          modality_id: event.target.value,
                          modalityName: modality?.name || "",
                          ...(row.id ? {} : { monthly_value: modality?.default_monthly_value ?? row.monthly_value }),
                        });
                      }}
                    >
                      <option value="" disabled>
                        Escolha...
                      </option>
                      {modalityOptions.map((modality) => (
                        <option key={modality.id} value={modality.id}>
                          {modality.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Mensalidade</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.monthly_value}
                      onChange={(event) => updateRow(row.key, { monthly_value: event.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Vence dia</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={row.due_day}
                      onChange={(event) => updateRow(row.key, { due_day: event.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select value={row.status} onChange={(event) => updateRow(row.key, { status: event.target.value })}>
                      <option value="active">Ativa</option>
                      <option value="paused">Pausada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="table-action danger enrollment-remove"
                    onClick={() =>
                      row.id
                        ? updateRow(row.key, { removed: true })
                        : setRows((current) => current.filter((item) => item.key !== row.key))
                    }
                    aria-label={`Remover ${row.modalityName || "modalidade"}`}
                  >
                    {icons.trash}
                    Remover
                  </button>
                </div>
              ),
            )}
            <button type="button" className="button secondary add-modality" onClick={addRow}>
              {icons.plus} Adicionar modalidade
            </button>
            {Number(rows.find((row) => !row.removed)?.due_day) > 28 && (
              <small className="muted">Em meses mais curtos, o vencimento cai no último dia do mês.</small>
            )}
          </fieldset>
        ) : (
          <fieldset className="field wide modality-picker">
            <legend>Modalidades</legend>
            {modalities.map((modality, index) => (
              <label className="modality-option" key={modality.id}>
                <span>
                  <input name="modality_ids" type="checkbox" value={modality.id} defaultChecked={index === 0} />
                  {modality.name}
                </span>
                <input
                  name={`monthly_value_${modality.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={modality.default_monthly_value || "0"}
                  aria-label={`Mensalidade de ${modality.name}`}
                />
              </label>
            ))}
          </fieldset>
        )}

        {!isEditing && (
          <label className="field">
            <span>Vencimento (dia)</span>
            <input name="due_day" type="number" min="1" max="31" defaultValue="10" required />
          </label>
        )}
        {!isEditing && (
          <label className="field wide">
            <span>Observações</span>
            <textarea name="notes" placeholder="Horário, desconto, observações..." />
          </label>
        )}
      </div>
      <div className="button-row form-actions">
        <button className="button primary">{isEditing ? "Salvar alterações" : "Cadastrar"}</button>
        {isEditing && (
          <button className="button secondary cancel-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function MonthlyReceivedChart({ series, methods = [] }) {
  const max = Math.max(1, ...series.map((item) => item.amount));
  const chartHeight = 148;
  const topPad = 28;
  const bottomPad = 36;
  const leftPad = 8;
  const rightPad = 8;
  const barGap = 8;
  const innerWidth = 680;
  const barWidth = series.length
    ? Math.max(28, Math.floor((innerWidth - barGap * (series.length - 1)) / series.length))
    : 28;
  const plotWidth = series.length * barWidth + Math.max(0, series.length - 1) * barGap;
  const width = leftPad + plotWidth + rightPad;
  const height = topPad + chartHeight + bottomPad;
  const total = series.reduce((sum, item) => sum + item.amount, 0);
  const methodTotalCount = methods.reduce((sum, item) => sum + item.count, 0);
  const methodMax = Math.max(1, ...methods.map((item) => item.amount));

  return (
    <section className="panel monthly-chart-panel">
      <div className="panel-header">
        <div>
          <h2>Recebido por mês</h2>
          <p>Últimos 12 meses · total {formatMoney(total)}</p>
        </div>
      </div>
      <div className="panel-body monthly-chart-body">
        <div className="monthly-chart-scroll">
          <svg
            className="monthly-chart"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Gráfico de valores recebidos por mês"
          >
            <line
              className="monthly-baseline"
              x1={leftPad}
              y1={topPad + chartHeight}
              x2={leftPad + plotWidth}
              y2={topPad + chartHeight}
            />
            {series.map((item, index) => {
              const rawHeight = (item.amount / max) * chartHeight;
              const barHeight = item.amount > 0 ? Math.max(8, rawHeight) : 2;
              const x = leftPad + index * (barWidth + barGap);
              const y = topPad + chartHeight - barHeight;
              let stackY = topPad + chartHeight;
              const segments = paymentMethods
                .map((method) => method.value)
                .concat(Object.keys(item.byMethod || {}).filter((key) => !methodColors[key] || key === "other"))
                .filter((key, position, list) => list.indexOf(key) === position && item.byMethod?.[key] > 0)
                .map((key) => {
                  const segmentHeight = (item.byMethod[key] / item.amount) * barHeight;
                  stackY -= segmentHeight;
                  return { key, y: stackY, height: segmentHeight };
                });
              return (
                <g key={item.month}>
                  <title>
                    {`${item.label}: ${formatMoney(item.amount)}${Object.entries(item.byMethod || {})
                      .map(([key, value]) => `\n${paymentMethodLabel(key)}: ${formatMoney(value)}`)
                      .join("")}`}
                  </title>
                  <rect
                    className="monthly-bar-track"
                    x={x}
                    y={topPad}
                    width={barWidth}
                    height={chartHeight}
                    rx="8"
                  />
                  {item.amount > 0 ? (
                    <>
                      <clipPath id={`bar-clip-${item.month}`}>
                        <rect x={x} y={y} width={barWidth} height={barHeight} rx="8" />
                      </clipPath>
                      <g clipPath={`url(#bar-clip-${item.month})`} className="monthly-bar-stack">
                        {segments.map((segment) => (
                          <rect
                            key={segment.key}
                            x={x}
                            y={segment.y}
                            width={barWidth}
                            height={segment.height + 0.5}
                            fill={methodColor(segment.key)}
                          />
                        ))}
                      </g>
                    </>
                  ) : (
                    <rect className="monthly-bar monthly-bar-stub" x={x} y={y} width={barWidth} height={barHeight} rx="2" />
                  )}
                  {item.amount > 0 && (
                    <text className="monthly-value" x={x + barWidth / 2} y={y - 8} textAnchor="middle">
                      {formatCompactMoney(item.amount)}
                    </text>
                  )}
                  <text
                    className="monthly-label"
                    x={x + barWidth / 2}
                    y={topPad + chartHeight + 18}
                    textAnchor="middle"
                  >
                    {item.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <ul className="chart-legend" aria-label="Legenda das formas de pagamento">
          {paymentMethods.map((method) => (
            <li key={method.value}>
              <span className="legend-dot" style={{ background: methodColor(method.value) }} />
              {method.label}
            </li>
          ))}
        </ul>

        <div className="method-breakdown">
          <div className="method-breakdown-header">
            <div>
              <h3>Por forma de pagamento</h3>
              <p>
                Mesmos últimos 12 meses · {methodTotalCount}{" "}
                {methodTotalCount === 1 ? "pagamento" : "pagamentos"}
              </p>
            </div>
          </div>
          {methods.length ? (
            <div className="method-breakdown-grid">
              {methods.map((item) => (
                <article className="method-card" key={item.value} style={{ "--method-color": methodColor(item.value) }}>
                  <div className="method-card-top">
                    <strong>
                      <span className="legend-dot" style={{ background: methodColor(item.value) }} />
                      {item.label}
                    </strong>
                    <span className="method-count">
                      {item.count} {item.count === 1 ? "pagamento" : "pagamentos"}
                    </span>
                  </div>
                  <span className="method-amount">{formatMoney(item.amount)}</span>
                  <span className="method-track" aria-hidden="true">
                    <span
                      className="method-fill"
                      style={{
                        width: `${Math.max(10, (item.amount / methodMax) * 100)}%`,
                        background: methodColor(item.value),
                      }}
                    />
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted method-empty">Nenhum pagamento nos últimos 12 meses.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function formatCompactMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 1000) {
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }
  return formatMoney(amount);
}

function ChartPanel({ title, values }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((entry) => entry[1]));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{entries.length ? "Valores do período selecionado." : "Sem pagamentos no período."}</p>
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

function StudentCell({ enrollment }) {
  return (
    <span className="student-cell">
      <strong>{enrollment.studentName}</strong>
      <span>{enrollment.student?.phone || "Sem telefone do aluno"}</span>
    </span>
  );
}

function GuardianCell({ enrollment }) {
  return (
    <span className="student-cell">
      <strong>{enrollment.guardianName}</strong>
      <span>{enrollment.guardian?.email || enrollment.guardian?.phone || "Sem contato"}</span>
    </span>
  );
}

function StaffCell({ profile }) {
  return (
    <span className="student-cell staff-cell">
      <strong>{profile?.full_name || "Funcionário"}</strong>
      <span>{profile?.email || "-"}</span>
    </span>
  );
}

function getPaymentStatus(enrollment, paymentStatus, month) {
  if (enrollment.status !== "active") {
    return { key: "inactive", label: "Inativo", className: "neutral" };
  }

  if (paymentStatus) {
    return { key: "paid", label: "Pago", className: "success" };
  }

  const dueDate = dueDateFor(month, enrollment.due_day);
  if (month < currentMonth() || dueDate < localDate()) {
    return { key: "late", label: "Atrasado", className: "danger" };
  }

  return { key: "pending", label: "Pendente", className: "warning" };
}

function getGroupedPaymentStatus(enrollments) {
  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === "active");
  if (!activeEnrollments.length) {
    return { key: "inactive", label: "Inativo", className: "neutral", isActive: false };
  }

  if (activeEnrollments.every((enrollment) => enrollment.paymentStatusKey === "paid")) {
    return { key: "paid", label: "Pago", className: "success", isActive: true };
  }

  if (activeEnrollments.some((enrollment) => enrollment.paymentStatusKey === "late")) {
    return { key: "late", label: "Atrasado", className: "danger", isActive: true };
  }

  return { key: "pending", label: "Pendente", className: "warning", isActive: true };
}

function groupPayments(payments, getKey) {
  return payments.reduce((groups, payment) => {
    const key = getKey(payment);
    groups[key] = (groups[key] || 0) + Number(payment.amount);
    return groups;
  }, {});
}

function groupPaymentItems(payments, getKey) {
  return payments.reduce((groups, payment) => {
    (payment.items || []).forEach((item) => {
      const key = getKey(item, payment);
      groups[key] = (groups[key] || 0) + Number(item.amount);
    });
    return groups;
  }, {});
}

function paymentMethodLabel(value) {
  return paymentMethods.find((method) => method.value === value)?.label || value;
}

function profileLabel(profile) {
  if (!profile) return "Funcionário";
  if (profile.full_name && profile.email) return `${profile.full_name} (${profile.email})`;
  return profile.full_name || profile.email || "Funcionário";
}

function paymentPayerLabel(payment) {
  if (payment.payer?.full_name) return payment.payer.full_name;
  if (payment.payer_name) return payment.payer_name;
  const firstItem = payment.items?.[0];
  return firstItem?.student_name || firstItem?.enrollment?.student?.full_name || "Responsável não informado";
}

function paymentItemsLabel(payment) {
  const items = payment.items || [];
  if (!items.length) return "Sem itens vinculados";

  return items
    .map((item) => {
      const student = item.student_name || item.enrollment?.student?.full_name || "Aluno";
      const modality = item.modality_name || item.enrollment?.modality?.name || "Modalidade";
      return `${student} - ${modality}`;
    })
    .join(", ");
}

function sumEnrollments(enrollments) {
  return enrollments.reduce((sum, enrollment) => sum + Number(enrollment.monthly_value), 0);
}

function allocatePaymentItems(total, enrollments) {
  const totalCents = Math.round(Number(total || 0) * 100);
  const baseCents = enrollments.map((enrollment) =>
    Math.max(0, Math.round(Number(enrollment.monthly_value || 0) * 100)),
  );
  const baseTotal = baseCents.reduce((sum, value) => sum + value, 0);
  let usedCents = 0;

  return enrollments.map((enrollment, index) => {
    const remaining = totalCents - usedCents;
    const cents =
      index === enrollments.length - 1
        ? remaining
        : baseTotal > 0
          ? Math.round((totalCents * baseCents[index]) / baseTotal)
          : Math.floor(totalCents / enrollments.length);

    usedCents += cents;

    return {
      enrollment_id: enrollment.id,
      amount: Number((cents / 100).toFixed(2)),
    };
  });
}

function exportPaymentsCsv(payments, start, end) {
  const rows = [
    ["Data", "Responsável", "Alunos e modalidades", "Forma", "Valor", "Lançado por", "Observação"],
    ...payments.map((payment) => [
      formatDate(payment.paid_at),
      paymentPayerLabel(payment),
      paymentItemsLabel(payment),
      paymentMethodLabel(payment.method),
      String(payment.amount).replace(".", ","),
      profileLabel(payment.registered_by_profile),
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
