"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSponsorInquiry } from "@/actions/sponsors";

interface Props {
  sponsorId: string;
  sponsorName: string;
}

export default function SponsorContactButton({ sponsorId, sponsorName }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitSponsorInquiry(sponsorId, formData);
      setResult(res);
      if (res.ok) formRef.current?.reset();
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setResult(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-1 text-center text-sm font-semibold bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Contact
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact {sponsorName}</DialogTitle>
            <DialogDescription>
              Send a sponsorship inquiry. The sponsor will receive your message and can reply directly to you.
            </DialogDescription>
          </DialogHeader>

          {result?.ok ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-2xl">✅</p>
              <p className="font-semibold text-gray-900">Inquiry sent!</p>
              <p className="text-sm text-gray-500">
                {sponsorName} will receive your message and reply to your email.
              </p>
              <Button variant="outline" className="mt-2" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="replyTo">Your email <span className="text-destructive">*</span></Label>
                <Input
                  id="replyTo"
                  name="replyTo"
                  type="email"
                  required
                  placeholder="you@example.com"
                />
                <p className="text-xs text-muted-foreground">The sponsor will reply to this address.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message <span className="text-destructive">*</span></Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  maxLength={2000}
                  placeholder={`Hi ${sponsorName},\n\nI'm organizing a fishing tournament and would love to discuss a sponsorship opportunity...`}
                />
              </div>

              {result?.error && (
                <p className="text-sm text-destructive">{result.error}</p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Sending…" : "Send Inquiry"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
