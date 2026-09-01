"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { useSession } from "@/components/session-provider";

type StudentSubmission = {
  id: number;
  fullName: string;
  collegeName: string;
  studentIdText: string;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

type DriverSubmission = {
  id: number;
  vehicleNumber: string;
  vehicleType: string;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

const STATUS_BADGE: Record<string, "amber" | "mint" | "rose" | "slate" | "brand"> = {
  NOT_SUBMITTED: "slate",
  PENDING: "amber",
  VERIFIED: "mint",
  APPROVED: "mint",
  REJECTED: "rose",
  LEGACY_AUTO: "brand",
};

export default function VerificationPage() {
  const { user, refresh } = useSession();
  const { push } = useToast();

  const [studentData, setStudentData] = useState<{ verificationStatus: string; submissions: StudentSubmission[] } | null>(null);
  const [driverData, setDriverData] = useState<{ driverVerificationStatus: string; driverVerified: boolean; studentVerified: boolean; submissions: DriverSubmission[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"student" | "driver">("student");

  // Student form
  const [sFullName, setSFullName] = useState("");
  const [sCollege, setSCollege] = useState("");
  const [sStudentId, setSStudentId] = useState("");
  const [sFile, setSFile] = useState<File | null>(null);
  const [sSubmitting, setSSubmitting] = useState(false);

  // Driver form
  const [dVehicleNo, setDVehicleNo] = useState("");
  const [dVehicleType, setDVehicleType] = useState("scooter");
  const [dLicenceFile, setDLicenceFile] = useState<File | null>(null);
  const [dRegFile, setDRegFile] = useState<File | null>(null);
  const [dSubmitting, setDSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes] = await Promise.all([
        fetch("/api/verification/student", { cache: "no-store" }),
        fetch("/api/verification/driver", { cache: "no-store" }),
      ]);
      if (sRes.ok) setStudentData(await sRes.json());
      if (dRes.ok) setDriverData(await dRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void load();
      setSFullName(user.fullName);
      setSCollege(user.college);
      setSStudentId(user.studentId);
    } else {
      setLoading(false);
    }
  }, [user, load]);

  const submitStudent = async () => {
    if (!sFile) { push({ title: "Upload your college ID card", tone: "error" }); return; }
    setSSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("fullName", sFullName);
      fd.append("collegeName", sCollege);
      fd.append("studentIdText", sStudentId);
      fd.append("document", sFile);
      const res = await fetch("/api/verification/student", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        push({ title: "Verification submitted", body: data.message, tone: "success" });
        await load();
        await refresh();
      } else {
        push({ title: "Submission failed", body: data.error, tone: "error" });
      }
    } finally {
      setSSubmitting(false);
    }
  };

  const submitDriver = async () => {
    if (!dLicenceFile || !dRegFile) { push({ title: "Upload both documents", tone: "error" }); return; }
    setDSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("vehicleNumber", dVehicleNo);
      fd.append("vehicleType", dVehicleType);
      fd.append("licenceDocument", dLicenceFile);
      fd.append("vehicleRegDocument", dRegFile);
      const res = await fetch("/api/verification/driver", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        push({ title: "Driver verification submitted", body: data.message, tone: "success" });
        await load();
        await refresh();
      } else {
        push({ title: "Submission failed", body: data.error, tone: "error" });
      }
    } finally {
      setDSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState icon="🛡" title="Login to verify your identity" body="Upload your college ID card and get verified to book and offer rides." action={<Link href="/login?next=/verification"><Button>Login</Button></Link>} />
      </div>
    );
  }

  if (loading) return <Spinner label="Loading verification status…" />;

  const studentStatus = studentData?.verificationStatus ?? user.verificationStatus;
  const canSubmitStudent = studentStatus !== "VERIFIED" && studentStatus !== "PENDING";
  const latestStudentSub = studentData?.submissions?.[0];

  const driverStatus = driverData?.driverVerificationStatus ?? "NOT_SUBMITTED";
  const canSubmitDriver = driverData?.studentVerified && driverStatus !== "APPROVED" && driverStatus !== "PENDING";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="animate-[fade-up_0.4s_ease-out]">
        <Badge tone="brand">Identity Verification</Badge>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[40px]">
          Verify Your Identity
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
          Upload your documents once. An admin will review and verify your identity within 24 hours.
        </p>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar mt-7 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "student" as const, label: "🎓 Student Verification", badge: studentStatus },
          { id: "driver" as const, label: "🚗 Driver Verification", badge: driverStatus },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${tab === t.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
          >
            {t.label}
            <Badge tone={STATUS_BADGE[t.badge] ?? "slate"}>{t.badge}</Badge>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "student" ? (
          <div className="space-y-6">
            {/* Current status */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">Student Verification Status</p>
                  <p className="text-xs text-slate-500">Your college ID card must be verified by an admin before you can book or offer rides.</p>
                </div>
                <Badge tone={STATUS_BADGE[studentStatus] ?? "slate"} className="text-sm px-4 py-2">
                  {studentStatus === "LEGACY_AUTO" ? "Auto-Verified (Legacy)" : studentStatus}
                </Badge>
              </div>

              {latestStudentSub?.status === "REJECTED" && latestStudentSub.rejectionReason ? (
                <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <p className="text-sm font-bold text-rose-700">❌ Rejection reason:</p>
                  <p className="mt-1 text-sm text-rose-600">{latestStudentSub.rejectionReason}</p>
                  <p className="mt-2 text-xs text-rose-500">You can upload a corrected document below and resubmit.</p>
                </div>
              ) : null}

              {studentStatus === "VERIFIED" ? (
                <div className="mt-4 rounded-2xl border border-mint-100 bg-mint-50 p-4 text-sm text-mint-700">
                  ✅ Your student identity is verified. You can book rides and access all features.
                </div>
              ) : null}

              {studentStatus === "PENDING" ? (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                  ⏳ Your verification is under review. An admin will review it within 24 hours.
                </div>
              ) : null}

              {studentStatus === "LEGACY_AUTO" ? (
                <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">
                  ⚡ You were auto-verified under the old system. Your access continues, but an admin may ask you to upload your ID card for proper verification.
                </div>
              ) : null}
            </div>

            {/* Submit form */}
            {canSubmitStudent ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
                <h2 className="text-lg font-bold text-slate-900">Submit Verification</h2>
                <p className="mt-1 text-xs text-slate-500">Upload a clear photo or scan of your college/student ID card.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name">
                    <Input value={sFullName} onChange={(e) => setSFullName(e.target.value)} placeholder="Your full name" />
                  </Field>
                  <Field label="College Name">
                    <Input value={sCollege} onChange={(e) => setSCollege(e.target.value)} placeholder="MIT College, Kothrud" />
                  </Field>
                  <Field label="Student / Enrollment ID">
                    <Input value={sStudentId} onChange={(e) => setSStudentId(e.target.value)} placeholder="MIT2022CS1042" />
                  </Field>
                  <Field label="College ID Card (JPG, PNG or PDF, max 5 MB)">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setSFile(e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                    />
                  </Field>
                </div>
                <Button full size="lg" className="mt-5" loading={sSubmitting} onClick={submitStudent}>
                  🛡 Submit for Verification
                </Button>
              </div>
            ) : null}

            {/* History */}
            {studentData?.submissions && studentData.submissions.length > 0 ? (
              <div>
                <h3 className="text-sm font-bold text-slate-900">Submission History</h3>
                <div className="mt-3 space-y-2">
                  {studentData.submissions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{s.collegeName} · {s.studentIdText}</p>
                        <p className="text-[11px] text-slate-400">Submitted {new Date(s.submittedAt).toLocaleDateString()}</p>
                      </div>
                      <Badge tone={STATUS_BADGE[s.status] ?? "slate"}>{s.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Driver status */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">Driver Verification Status</p>
                  <p className="text-xs text-slate-500">Upload your driving licence and vehicle registration to offer rides.</p>
                </div>
                <Badge tone={STATUS_BADGE[driverStatus] ?? "slate"} className="text-sm px-4 py-2">
                  {driverStatus}
                </Badge>
              </div>

              {!driverData?.studentVerified ? (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                  ⚠️ You must complete student verification first before applying as a driver.
                  <Link href="/verification" className="ml-2 font-bold underline" onClick={() => setTab("student")}>Verify student identity →</Link>
                </div>
              ) : null}

              {driverStatus === "APPROVED" ? (
                <div className="mt-4 rounded-2xl border border-mint-100 bg-mint-50 p-4 text-sm text-mint-700">
                  ✅ You are an approved driver. You can offer rides.
                </div>
              ) : null}

              {driverStatus === "PENDING" ? (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                  ⏳ Your driver verification is under review.
                </div>
              ) : null}

              {driverData?.submissions?.[0]?.status === "REJECTED" && driverData.submissions[0].rejectionReason ? (
                <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <p className="text-sm font-bold text-rose-700">❌ Rejection reason:</p>
                  <p className="mt-1 text-sm text-rose-600">{driverData.submissions[0].rejectionReason}</p>
                </div>
              ) : null}
            </div>

            {/* Driver submit form */}
            {canSubmitDriver ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
                <h2 className="text-lg font-bold text-slate-900">Submit Driver Documents</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Vehicle Number">
                    <Input value={dVehicleNo} onChange={(e) => setDVehicleNo(e.target.value)} placeholder="MH12AB1234" />
                  </Field>
                  <Field label="Vehicle Type">
                    <Select value={dVehicleType} onChange={(e) => setDVehicleType(e.target.value)}>
                      <option value="scooter">Scooter</option>
                      <option value="bike">Bike</option>
                      <option value="car">Car</option>
                    </Select>
                  </Field>
                  <Field label="Driving Licence (JPG, PNG or PDF)">
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDLicenceFile(e.target.files?.[0] ?? null)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700" />
                  </Field>
                  <Field label="Vehicle Registration Document (JPG, PNG or PDF)">
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDRegFile(e.target.files?.[0] ?? null)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700" />
                  </Field>
                </div>
                <Button full size="lg" className="mt-5" loading={dSubmitting} onClick={submitDriver}>
                  🚗 Submit Driver Documents
                </Button>
              </div>
            ) : null}

            {/* History */}
            {driverData?.submissions && driverData.submissions.length > 0 ? (
              <div>
                <h3 className="text-sm font-bold text-slate-900">Driver Submission History</h3>
                <div className="mt-3 space-y-2">
                  {driverData.submissions.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{d.vehicleType} · {d.vehicleNumber}</p>
                        <p className="text-[11px] text-slate-400">Submitted {new Date(d.submittedAt).toLocaleDateString()}</p>
                      </div>
                      <Badge tone={STATUS_BADGE[d.status] ?? "slate"}>{d.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
