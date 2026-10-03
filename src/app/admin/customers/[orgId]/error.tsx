"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function CustomerError({ reset }: { reset: () => void }) {
  return <div className="rounded-2xl border bg-card p-8 text-center"><h2 className="text-lg font-semibold">Could not load this customer</h2><p className="mt-2 text-sm text-muted-foreground">Account details are temporarily unavailable. Please try again.</p><div className="mt-5 flex justify-center gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" render={<Link href="/admin/customers" />}>All customers</Button></div></div>;
}
