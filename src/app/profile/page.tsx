"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Stars,
  useToast,
} from "@/components/ui";
import { COLLEGES, formatDatePretty, LOCALITIES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";
import type { BlockItemDTO, PublicUserDTO, ReviewItem } from "@/lib/types";

export default function ProfilePage() {
  const { user, refresh } = useSession();
  const { push } = useToast();
  const [profile, setProfile] = useState<PublicUserDTO | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<BlockItemDTO[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    college: "",
    homeLocation: "",
    studentId: "",
    gender: "prefer_not_say",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = (await res.json()) as { user: PublicUserDTO | null; reviews: ReviewItem[] };
      setProfile(data.user);
      setReviews(data.reviews ?? []);
      if (data.user) {
        setForm({
          fullName: data.user.fullName,
          phone: data.user.phone,
          college: data.user.college,
          homeLocation: data.user.homeLocation,
          studentId: data.user.studentId,
          gender: data.user.gender,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const res = await fetch("/api/blocks", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { blocks?: BlockItemDTO[] };
        setBlocks(data.blocks ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, [user]);

  const unblock = async (id: number) => {
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedUserId: id, action: "unblock" }),
    });
    if (res.ok) {
      push({ title: "Student unblocked", tone: "success" });
      setBlocks((prev) => prev.filter((b) => b.blockedUserId !== id));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        push({ title: "Could not save", body: data.error, tone: "error" });
        return;
      }
      push({ title: "Profile updated", tone: "success" });
      setEditOpen(false);
      await load();
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading profile…" />;

  if (!user || !profile) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="👤"
          title="Login to view your student profile"
          body="Your verified badge, completed rides, rating and reviews from other students appear here."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/login?next=/profile">
                <Button>Login</Button>
              </Link>
              <Link href="/signup">
                <Button variant="secondary">Sign up</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-card">
        <div className="h-28 bg-gradient-to-r from-brand-600 via-brand-500 to-mint-500" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="rounded-[26px] border-4 border-white bg-white shadow-card">
                <Avatar
                  name={profile.fullName}
                  color={profile.avatarColor}
                  verified={profile.verified}
                  size="xl"
                />
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  {profile.fullName}
                </h1>
                <p className="text-sm text-slate-500">{profile.college}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit profile
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {profile.verificationStatus === "VERIFIED" ? (
              <Badge tone="mint" className="px-3 py-1.5 text-xs">
                ✓ Verified College Student
              </Badge>
            ) : (
              <Badge tone="amber" className="px-3 py-1.5 text-xs">
                Verification {profile.verificationStatus.toLowerCase()} — add a valid student ID to
                unlock booking and payments
              </Badge>
            )}
            <Badge tone="slate">🎓 {profile.studentId}</Badge>
            <Badge tone="slate">📍 {profile.homeLocation || "Home area not set"}</Badge>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Completed rides", v: String(profile.ridesCompleted) },
              { k: "Rating", v: profile.rating > 0 ? `${profile.rating.toFixed(1)} ★` : "New" },
              { k: "Reviews", v: String(profile.ratingCount) },
              { k: "Verified", v: profile.verified ? "Yes" : "Pending" },
            ].map((stat) => (
              <div key={stat.k} className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {stat.k}
                </dt>
                <dd className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{stat.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Email</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800">{profile.email}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Phone (private)
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                🔒 {profile.phone ? `•••••${profile.phone.slice(-4)}` : "Not added yet"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/rides">
              <Button>My rides dashboard</Button>
            </Link>
            <Link href="/offer">
              <Button variant="success">Offer a ride</Button>
            </Link>
            <Link href="/safety">
              <Button variant="secondary">Safety centre</Button>
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Blocked students</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Blocked students cannot see your rides, book your seats or contact you.
        </p>
        {blocks.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            You have not blocked anyone. You can block a student from any ride page or the Safety
            Centre.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={b.blockedUserName} color={b.blockedUserColor} size="sm" />
                  <p className="truncate text-sm font-semibold text-slate-800">{b.blockedUserName}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => unblock(b.blockedUserId)}>
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Reviews from students
          </h2>
          <Stars rating={profile.rating} count={profile.ratingCount} />
        </div>
        {reviews.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="⭐"
              title="No reviews yet"
              body="Complete a ride and your co-rider will rate you. Great ratings make your rides get booked faster."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={review.reviewerName} color={review.reviewerColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{review.reviewerName}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDatePretty(review.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <span className="text-sm text-amber-500">
                    {"★".repeat(review.rating)}
                    <span className="text-slate-200">{"★".repeat(5 - review.rating)}</span>
                  </span>
                </div>
                {review.comment ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">“{review.comment}”</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <div className="space-y-4">
          <Field label="Full name">
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="College">
              <Input
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                list="profile-colleges"
              />
            </Field>
            <Field label="Home / colony">
              <Input
                value={form.homeLocation}
                onChange={(e) => setForm({ ...form, homeLocation: e.target.value })}
                list="profile-localities"
              />
            </Field>
            <Field label="Student ID">
              <Input
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              />
            </Field>
            <Field label="Phone number">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Gender" hint="used for ride preferences">
            <Select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="prefer_not_say">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </Select>
          </Field>
          <p className="rounded-xl bg-brand-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
            A student ID with at least 5 characters and a digit marks your profile as VERIFIED, which
            unlocks ride publishing, booking, payments and access to other verified students&apos;
            contact details.
          </p>
          <Button full loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </Modal>

      <datalist id="profile-colleges">
        {COLLEGES.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
      <datalist id="profile-localities">
        {LOCALITIES.map((l) => (
          <option key={l.name} value={l.name} />
        ))}
      </datalist>
    </div>
  );
}
