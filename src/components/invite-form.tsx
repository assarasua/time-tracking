"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role })
    });

    if (!response.ok) {
      setMessage("Failed to send invitation");
      return;
    }

    setMessage("Invitation sent");
    setEmail("");
    setRole("employee");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Invite user</h3>
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="employee@company.com"
        required
      />
      <Select value={role} onChange={(event) => setRole(event.target.value)}>
        <option value="employee">Employee</option>
        <option value="admin">Admin</option>
      </Select>
      <Button type="submit" className="w-full sm:w-auto">
        Send invite
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
