import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const emptyData = {
  modalities: [],
  guardians: [],
  enrollments: [],
  paymentStatuses: [],
  payments: [],
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
  { value: "card", label: "Cartao" },
  { value: "transfer", label: "Transferencia" },
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
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [editingEnrollment, setEditingEnrollment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [reportStart, setReportStart] = useState(startOfMonth(currentMonth()));
  const [reportEnd, setReportEnd] = useState(endOfMonth(currentMonth()));
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState(emptyData);

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
          supabase
            .from("modalities")
            .select("id, name, default_monthly_value, is_active")
            .eq("is_active", true)
            .order("name"),
          supabase.from("guardians").select("id, full_name, email, phone, notes").order("full_name"),
          supabase
            .from("student_enrollments")
            .select(
              "id, monthly_value, due_day, status, notes, student:students(id, full_name, phone, guardian_id, guardian:guardians(id, full_name, email, phone)), modality:modalities(id, name, default_monthly_value)",
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("payment_statuses")
            .select("enrollment_id, reference_month, paid_at")
            .eq("reference_month", selectedReference),
        ];

        if (shouldLoadPayments) {
          requests.push(
            supabase
              .from("payments")
              .select(
                "id, reference_month, paid_at, amount, method, note, registered_by, payer_guardian_id, created_at, payer:guardians(id, full_name, email, phone), registered_by_profile:profiles!payments_registered_by_fkey(id, email, full_name), items:payment_items(id, enrollment_id, amount, enrollment:student_enrollments(id, monthly_value, student:students(id, full_name), modality:modalities(id, name)))",
              )
              .gte("paid_at", reportStart)
              .lte("paid_at", reportEnd)
              .order("paid_at", { ascending: false }),
            supabase.from("profiles").select("id, email, full_name, role, created_at").order("full_name"),
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

        setData({
          modalities: modalitiesResult.data || [],
          guardians: guardiansResult.data || [],
          enrollments: enrollmentsResult.data || [],
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
      setError(profileError.message);
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
          guardianName: guardian?.full_name || "Sem responsavel",
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

  async function resolveGuardian(form) {
    const fullName = String(form.get("guardian_name") || "").trim();
    const email = String(form.get("guardian_email") || "").trim().toLowerCase() || null;
    const phone = String(form.get("guardian_phone") || "").trim() || null;

    if (!fullName && !email && !phone) return null;

    if (email) {
      const { data: existingGuardian, error: findError } = await supabase
        .from("guardians")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (findError) throw findError;

      if (existingGuardian) {
        const { error: updateError } = await supabase
          .from("guardians")
          .update({
            full_name: fullName || email,
            email,
            phone,
          })
          .eq("id", existingGuardian.id);

        if (updateError) throw updateError;
        return existingGuardian.id;
      }
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
      setError(requestError.message);
    }
  }

  async function handleUpdateEnrollment(event) {
    event.preventDefault();
    if (!editingEnrollment) return;

    const form = new FormData(event.currentTarget);

    try {
      const guardianId = await resolveGuardian(form);
      const { error: studentError } = await supabase
        .from("students")
        .update({
          guardian_id: guardianId,
          full_name: String(form.get("full_name")).trim(),
          phone: String(form.get("phone")).trim() || null,
        })
        .eq("id", editingEnrollment.student.id);

      if (studentError) throw studentError;

      const { error: enrollmentError } = await supabase
        .from("student_enrollments")
        .update({
          modality_id: form.get("modality_id"),
          monthly_value: Number(form.get("monthly_value")),
          due_day: Number(form.get("due_day")),
          notes: String(form.get("notes")).trim() || null,
          status: form.get("status"),
        })
        .eq("id", editingEnrollment.id);

      if (enrollmentError) throw enrollmentError;

      setEditingEnrollment(null);
      showToast("Cadastro atualizado.");
      loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handlePayment(event) {
    event.preventDefault();
    if (!selectedEnrollment) return;

    const form = new FormData(event.currentTarget);
    const nextMonth = String(form.get("reference_month"));
    const enrollmentIds = form.getAll("enrollment_ids").map(String);

    if (!enrollmentIds.length) {
      setError("Selecione pelo menos uma matricula para dar baixa.");
      return;
    }

    const selectedItems = enrollmentIds
      .map((id) => enrichedEnrollments.find((enrollment) => enrollment.id === id))
      .filter(Boolean);

    const amount = Number(form.get("amount"));
    const itemAmounts = allocatePaymentItems(amount, selectedItems);

    const { error: paymentError } = await supabase.rpc("record_payment", {
      p_reference_month: referenceDate(nextMonth),
      p_paid_at: form.get("paid_at"),
      p_amount: amount,
      p_method: form.get("method"),
      p_note: String(form.get("note")).trim() || null,
      p_payer_guardian_id: selectedEnrollment.guardian?.id || null,
      p_items: itemAmounts,
    });

    if (paymentError) {
      setError(paymentError.code === "23505" ? paymentError.message : paymentError.message);
      return;
    }

    setMonth(nextMonth);
    setSelectedEnrollment(null);
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
    const itemEnrollments = (editingPayment.items || []).map((item) => ({
      id: item.enrollment_id,
      monthly_value: item.enrollment?.monthly_value || item.amount,
    }));
    const itemAmounts = allocatePaymentItems(amount, itemEnrollments);

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        reference_month: referenceDate(nextReferenceMonth),
        paid_at: form.get("paid_at"),
        amount,
        method: form.get("method"),
        note: String(form.get("note")).trim() || null,
      })
      .eq("id", editingPayment.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const itemUpdates = await Promise.all(
      (editingPayment.items || []).map((item) => {
        const nextItem = itemAmounts.find((allocatedItem) => allocatedItem.enrollment_id === item.enrollment_id);
        return supabase
          .from("payment_items")
          .update({
            reference_month: referenceDate(nextReferenceMonth),
            amount: nextItem?.amount ?? item.amount,
          })
          .eq("id", item.id);
      }),
    );

    const itemError = itemUpdates.find((result) => result.error)?.error;
    if (itemError) {
      setError(
        itemError.code === "23505"
          ? "Uma das matriculas ja tem pagamento lancado nesse mes."
          : itemError.message,
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

    showToast("Usuario atualizado.");
    loadData();
    if (profileId === session.user.id) {
      loadProfile(profileId);
    }
  }

  async function handleEnrollmentStatus(enrollment) {
    const enrollmentIds = enrollment.enrollmentIds?.length ? enrollment.enrollmentIds : [enrollment.id];
    if (!enrollmentIds.length) {
      setError("Matriculas invalidas para atualizar status.");
      return;
    }

    const nextStatus = enrollment.status === "active" ? "paused" : "active";
    const { error: updateError } = await supabase
      .from("student_enrollments")
      .update({ status: nextStatus })
      .in("id", enrollmentIds);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    showToast(nextStatus === "active" ? "Matriculas ativadas." : "Matriculas pausadas.");
    loadData();
  }

  async function handleDeleteStudent(enrollment) {
    const studentId = enrollment?.student?.id;
    const studentName = enrollment?.studentName || enrollment?.student?.full_name || "este aluno";

    if (!studentId) {
      setError("Aluno invalido para exclusao.");
      return;
    }

    if (!window.confirm(`Excluir ${studentName}? Isso remove todas as matriculas desse aluno.`)) return;

    const { error: deleteError } = await supabase.from("students").delete().eq("id", studentId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingEnrollment?.student?.id === studentId) {
      setEditingEnrollment(null);
    }
    if (selectedEnrollment?.student?.id === studentId) {
      setSelectedEnrollment(null);
    }

    showToast("Aluno excluido.");
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
            <strong>Escola de Musica</strong>
            <span>Mensalidades</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegacao principal">
          <NavButton active={view === "payments"} onClick={() => setView("payments")} icon={icons.wallet}>
            Pagamentos
          </NavButton>
          <NavButton active={view === "pending"} onClick={() => setView("pending")} icon={icons.clock}>
            Pendencias
          </NavButton>
          <NavButton active={view === "students"} onClick={() => setView("students")} icon={icons.users}>
            Cadastros
          </NavButton>
          {isAdmin && (
            <>
              <NavButton active={view === "reports"} onClick={() => setView("reports")} icon={icons.chart}>
                Relatorios
              </NavButton>
              <NavButton active={view === "users"} onClick={() => setView("users")} icon={icons.lock}>
                Usuarios
              </NavButton>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="role-pill">{isAdmin ? "Administrador" : "Funcionario"}</span>
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
              {monthLabel(month)} - {isAdmin ? "visao completa" : "visao operacional"}
            </p>
          </div>

          <div className="topbar-actions">
            <label className="field compact">
              <span>Mes</span>
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  const nextMonth = event.target.value || currentMonth();
                  setMonth(nextMonth);
                  setReportStart(startOfMonth(nextMonth));
                  setReportEnd(endOfMonth(nextMonth));
                  setSelectedEnrollment(null);
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
            profile={profile}
            selectedEnrollment={selectedEnrollment}
            setModalityFilter={setModalityFilter}
            setSearch={setSearch}
            setSelectedEnrollment={setSelectedEnrollment}
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
              setView("payments");
            }}
          />
        )}

        {view === "students" && (
          <StudentsView
            data={data}
            editingEnrollment={editingEnrollment}
            filteredEnrollments={filteredEnrollments}
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
          Crie um arquivo <code>.env.local</code> com a URL e a chave publica do seu projeto.
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
        <p>Verificando sessao no Supabase.</p>
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
      setMessage(response.error.message);
    }

    setLoading(false);
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-mark dark">{icons.music}</span>
        <h1>Mensalidades</h1>
        <p>Acesso interno para funcionarios cadastrados no Supabase Auth.</p>

        <form onSubmit={handleAuth} className="auth-form">
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
            {loading ? "Aguarde..." : "Entrar"}
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
          <EnrollmentFilters {...props} />
          <EnrollmentTable
            enrollments={props.filteredEnrollments}
            context="payments"
            onSelect={props.setSelectedEnrollment}
          />
        </div>
        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>Registrar pagamento</h2>
              <p>Selecione uma pendencia e marque todas as matriculas pagas junto.</p>
            </div>
          </div>
          <div className="panel-body">
            {props.selectedEnrollment ? (
              <PaymentForm
                availableEnrollments={props.paymentOptions}
                enrollment={props.selectedEnrollment}
                month={props.month}
                profile={props.profile}
                onSubmit={props.onPayment}
              />
            ) : (
              <EmptyState title="Nenhum cadastro selecionado" text="Clique em lancar para preencher o pagamento." />
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
    (enrollment) => `${month}-${String(enrollment.due_day).padStart(2, "0")}` === today,
  ).length;

  return (
    <>
      <section className="metric-grid" aria-label="Resumo de pendencias">
        <Metric label="Pendentes" value={totals.pendingCount} detail="Ainda sem baixa no mes" icon={icons.clock} />
        <Metric label="Atrasados" value={totals.lateCount} detail="Vencimento ja passou" icon={icons.wallet} />
        <Metric label="Vencem hoje" value={dueTodayCount} detail="Precisam de acompanhamento" icon={icons.check} />
        <Metric
          label={isAdmin ? "Valor em aberto" : "Matriculas ativas"}
          value={isAdmin ? formatMoney(totals.pendingValue) : totals.activeCount}
          detail={isAdmin ? "Estimativa das mensalidades" : "Alunos e modalidades"}
          icon={icons.users}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Pendencias do mes</h2>
            <p>Matriculas ativas sem pagamento lancado em {monthLabel(month)}.</p>
          </div>
        </div>
        <PendingTable enrollments={pendingEnrollments} isAdmin={isAdmin} onSelectEnrollment={onSelectEnrollment} />
      </section>
    </>
  );
}

function PendingTable({ enrollments, isAdmin, onSelectEnrollment }) {
  if (!enrollments.length) {
    return <EmptyState title="Tudo certo por aqui" text="Nao ha pendencias no mes selecionado." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Responsavel</th>
            <th>Modalidade</th>
            <th>Vencimento</th>
            {isAdmin && <th>Valor</th>}
            <th>Status</th>
            <th>Acao</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => (
            <tr key={enrollment.id}>
              <td>
                <StudentCell enrollment={enrollment} />
              </td>
              <td>
                <GuardianCell enrollment={enrollment} />
              </td>
              <td>{enrollment.modalityName}</td>
              <td>Dia {enrollment.due_day}</td>
              {isAdmin && <td>{formatMoney(enrollment.monthly_value)}</td>}
              <td>
                <span className={`badge ${enrollment.paymentStatusClass}`}>{enrollment.paymentStatusLabel}</span>
              </td>
              <td>
                <button className="table-action primary" onClick={() => onSelectEnrollment(enrollment)}>
                  {icons.plus}
                  Lancar
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
  const isEditing = Boolean(props.editingEnrollment);

  return (
    <section className="split-grid">
      <div>
        <EnrollmentFilters {...props} />
        <EnrollmentTable
          enrollments={props.filteredEnrollments}
          context="students"
          onEditEnrollment={props.setEditingEnrollment}
          onEnrollmentStatus={props.onEnrollmentStatus}
          onDeleteStudent={props.onDeleteStudent}
        />
      </div>
      <aside className="panel">
        <div className="panel-header">
          <div>
            <h2>{isEditing ? "Editar matricula" : "Novo cadastro"}</h2>
            <p>
              {isEditing
                ? "Atualize aluno, responsavel, modalidade, valor e status."
                : "Cadastre o responsavel, o aluno e uma ou mais modalidades."}
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
  const byModality = groupPaymentItems(data.payments, (item) => item.enrollment?.modality?.name || "Sem modalidade");
  const byMethod = groupPayments(data.payments, (payment) => paymentMethodLabel(payment.method));
  const byDay = groupPayments(data.payments, (payment) => formatDate(payment.paid_at));

  return (
    <>
      <MetricGrid totals={totals} isAdmin />
      <section className="panel report-filter">
        <div className="panel-header">
          <div>
            <h2>Periodo do relatorio</h2>
            <p>Filtre por data de recebimento e exporte o historico.</p>
          </div>
        </div>
        <div className="panel-body report-controls">
          <label className="field">
            <span>Inicio</span>
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
            <h2>Historico do periodo</h2>
            <p>Veja o responsavel, os alunos pagos juntos e quem lancou a baixa.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Responsavel</th>
                <th>Alunos e modalidades</th>
                <th>Forma</th>
                <th>Valor</th>
                <th>Lancado por</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length ? (
                data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paid_at)}</td>
                    <td>{paymentPayerLabel(payment)}</td>
                    <td className="report-items">{paymentItemsLabel(payment)}</td>
                    <td>{paymentMethodLabel(payment.method)}</td>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>
                      <StaffCell profile={payment.registered_by_profile} />
                    </td>
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
                  <td colSpan="7" className="muted">
                    Nenhum pagamento registrado no periodo.
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
              <p>Altere mes, data, valor, forma ou observacao da baixa conjunta.</p>
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

function UsersView({ currentUserId, profiles, onUpdateProfile }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Usuarios e permissoes</h2>
          <p>Defina quem e administrador e quem e funcionario.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Acao</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((user) => (
              <tr key={user.id}>
                <td colSpan="4">
                  <form className="user-row" onSubmit={(event) => onUpdateProfile(event, user.id)}>
                    <input name="full_name" defaultValue={user.full_name} placeholder="Nome do usuario" />
                    <span>{user.email || user.id}</span>
                    <select name="role" defaultValue={user.role} disabled={user.id === currentUserId}>
                      <option value="staff">Funcionario</option>
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
          <h2>Cadastros e situacao</h2>
          <p>Filtre por aluno, responsavel, email, telefone, modalidade ou status.</p>
        </div>
      </div>
      <div className="panel-body search-box">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          type="search"
          placeholder="Buscar aluno, responsavel, email ou modalidade"
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
  onDeleteStudent,
  onEditEnrollment,
  onSelect,
  onEnrollmentStatus,
}) {
  if (!enrollments.length) {
    return <EmptyState title="Nenhum cadastro encontrado" text="Altere os filtros ou cadastre um novo aluno." />;
  }

  return (
    <section className="panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Responsavel</th>
              <th>Modalidade</th>
              <th>Vencimento</th>
              <th>Mensalidade</th>
              <th>Status</th>
              <th>Acao</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => {
              const canPay = enrollment.paymentStatusKey === "pending" || enrollment.paymentStatusKey === "late";

              return (
                <tr key={enrollment.id}>
                  <td>
                    <StudentCell enrollment={enrollment} />
                  </td>
                  <td>
                    <GuardianCell enrollment={enrollment} />
                  </td>
                  <td>{enrollment.modalityName}</td>
                  <td>Dia {enrollment.due_day}</td>
                  <td>{formatMoney(enrollment.monthly_value)}</td>
                  <td>
                    <span className={`badge ${enrollment.paymentStatusClass}`}>{enrollment.paymentStatusLabel}</span>
                  </td>
                  <td>
                    {context === "payments" ? (
                      canPay ? (
                        <button className="table-action primary" onClick={() => onSelect(enrollment)}>
                          {icons.plus}
                          Lancar
                        </button>
                      ) : (
                        <span className="muted">
                          {enrollment.paymentStatus?.paid_at
                            ? `Pago em ${formatDate(enrollment.paymentStatus.paid_at)}`
                            : "Sem acao"}
                        </span>
                      )
                    ) : (
                      <span className="table-actions">
                        <button
                          className="table-action secondary"
                          onClick={() => onEditEnrollment(enrollment.primaryEnrollment || enrollment)}
                        >
                          Editar
                        </button>
                        <button className="table-action secondary" onClick={() => onEnrollmentStatus(enrollment)}>
                          {enrollment.status === "active" ? "Pausar" : "Ativar"}
                        </button>
                        <button className="table-action danger" onClick={() => onDeleteStudent(enrollment)}>
                          {icons.trash}
                          Excluir aluno
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
        <Metric label="Recebido no periodo" value={formatMoney(totals.receivedPeriod)} detail={`${totals.paymentCount} pagamentos`} icon={icons.chart} />
        <Metric label="Pendencia estimada" value={formatMoney(totals.pendingValue)} detail="Matriculas nao pagas" icon={icons.clock} />
        <Metric label="Matriculas ativas" value={totals.activeCount} detail={`${totals.lateCount} atrasadas`} icon={icons.users} />
      </section>
    );
  }

  return (
    <section className="metric-grid" aria-label="Resumo operacional">
      <Metric label="Pagas" value={totals.paidCount} detail="No mes selecionado" icon={icons.check} />
      <Metric label="Pendentes" value={totals.pendingCount} detail="Ainda precisam de baixa" icon={icons.clock} />
      <Metric label="Atrasadas" value={totals.lateCount} detail="Vencimento ja passou" icon={icons.wallet} />
      <Metric label="Matriculas ativas" value={totals.activeCount} detail="Alunos e modalidades" icon={icons.users} />
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

function PaymentForm({ availableEnrollments, enrollment, month, onSubmit, profile }) {
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
        <span>{enrollment.guardian?.email || enrollment.contact || "Responsavel sem contato"}</span>
        <small>Lancado por {profileLabel(profile)}</small>
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
          <span>Observacao</span>
          <textarea name="note" placeholder="Desconto, pagamento parcial, bolsa..." />
        </label>
      </div>

      <div className="payment-summary">
        <span>{selectedEnrollments.length} matricula(s) selecionada(s)</span>
        <strong>{formatMoney(amount)}</strong>
      </div>

      <button className="button primary full form-actions" disabled={!selectedIds.length}>
        {icons.check} Confirmar baixa
      </button>
    </form>
  );
}

function PaymentEditForm({ onCancel, onSubmit, payment }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="selected-student">
        <strong>{paymentPayerLabel(payment)}</strong>
        <span>{paymentItemsLabel(payment)}</span>
        <small>Lancado por {profileLabel(payment.registered_by_profile)}</small>
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
          <span>Observacao</span>
          <textarea name="note" defaultValue={payment.note || ""} />
        </label>
      </div>
      <div className="button-row form-actions">
        <button className="button primary">Salvar correcao</button>
        <button className="button secondary" type="button" onClick={onCancel}>
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

  return (
    <form onSubmit={onSubmit}>
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
          <span>Responsavel</span>
          <input name="guardian_name" placeholder="Nome do responsavel" defaultValue={guardian?.full_name || ""} />
        </label>
        <label className="field">
          <span>Email do responsavel</span>
          <input name="guardian_email" type="email" placeholder="responsavel@email.com" defaultValue={guardian?.email || ""} />
        </label>
        <label className="field">
          <span>Telefone responsavel</span>
          <input name="guardian_phone" placeholder="(00) 00000-0000" defaultValue={guardian?.phone || ""} />
        </label>

        {isEditing ? (
          <>
            <label className="field">
              <span>Modalidade</span>
              <select name="modality_id" required defaultValue={enrollment.modality?.id || ""}>
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
                defaultValue={enrollment.monthly_value || "150"}
                required
              />
            </label>
          </>
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

        <label className="field">
          <span>Vencimento</span>
          <input name="due_day" type="number" min="1" max="31" defaultValue={enrollment?.due_day || "10"} required />
        </label>
        {isEditing && (
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={enrollment.status}>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
        )}
        <label className="field wide">
          <span>Observacoes</span>
          <textarea name="notes" placeholder="Horario, desconto, observacoes..." defaultValue={enrollment?.notes || ""} />
        </label>
      </div>
      <div className="button-row form-actions">
        <button className="button primary">{isEditing ? "Salvar alteracoes" : "Cadastrar"}</button>
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
          <p>{entries.length ? "Valores do periodo selecionado." : "Sem pagamentos no periodo."}</p>
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
          <EmptyState title="Sem dados" text="Os graficos aparecem depois dos lancamentos." />
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
      <strong>{profile?.full_name || "Funcionario"}</strong>
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

  const dueDate = `${month}-${String(enrollment.due_day).padStart(2, "0")}`;
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
  if (!profile) return "Funcionario";
  if (profile.full_name && profile.email) return `${profile.full_name} (${profile.email})`;
  return profile.full_name || profile.email || "Funcionario";
}

function paymentPayerLabel(payment) {
  if (payment.payer?.full_name) return payment.payer.full_name;
  const firstItem = payment.items?.[0];
  return firstItem?.enrollment?.student?.full_name || "Responsavel nao informado";
}

function paymentItemsLabel(payment) {
  const items = payment.items || [];
  if (!items.length) return "Sem itens vinculados";

  return items
    .map((item) => {
      const student = item.enrollment?.student?.full_name || "Aluno";
      const modality = item.enrollment?.modality?.name || "Modalidade";
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
    ["Data", "Responsavel", "Alunos e modalidades", "Forma", "Valor", "Lancado por", "Observacao"],
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
  if (view === "reports") return "Relatorios financeiros";
  if (view === "pending") return "Pendencias";
  if (view === "users") return "Usuarios";
  return "Pagamentos do mes";
}

export default App;
