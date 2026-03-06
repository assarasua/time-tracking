type RealtimeEvent =
  | {
      type: "time_session_changed";
      userId: string;
      organizationId: string;
      membershipId: string;
      at: string;
    }
  | {
      type: "heartbeat";
      at: string;
    };

type Subscriber = {
  id: string;
  userId: string;
  send: (event: RealtimeEvent) => void;
};

type RealtimeBus = {
  subscribers: Map<string, Subscriber>;
};

function getBus() {
  const globalState = globalThis as unknown as { __ttRealtimeBus?: RealtimeBus };
  if (!globalState.__ttRealtimeBus) {
    globalState.__ttRealtimeBus = {
      subscribers: new Map<string, Subscriber>()
    };
  }
  return globalState.__ttRealtimeBus;
}

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function subscribeRealtime(userId: string, send: (event: RealtimeEvent) => void) {
  const bus = getBus();
  const id = nextId();
  bus.subscribers.set(id, { id, userId, send });

  return () => {
    bus.subscribers.delete(id);
  };
}

export function publishTimeSessionChanged(params: {
  userId: string;
  organizationId: string;
  membershipId: string;
}) {
  const bus = getBus();
  const payload: RealtimeEvent = {
    type: "time_session_changed",
    userId: params.userId,
    organizationId: params.organizationId,
    membershipId: params.membershipId,
    at: new Date().toISOString()
  };

  for (const subscriber of bus.subscribers.values()) {
    if (subscriber.userId !== params.userId) continue;
    try {
      subscriber.send(payload);
    } catch {
      // ignore disconnected subscriber
    }
  }
}

export function heartbeatEvent(): RealtimeEvent {
  return { type: "heartbeat", at: new Date().toISOString() };
}
