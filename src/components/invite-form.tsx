"use client";

import { useState } from "react";

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
    <form onSubmit={onSubmit} className="stack">
      <h3 style={{ margin: 0 }}>Invite user</h3>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="employee@company.com"
        required
      />
      <select value={role} onChange={(event) => setRole(event.target.value)}>
        <option value="employee">Employee</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit">Send invite</button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}
