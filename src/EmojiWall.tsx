import { useEffect, useRef, useState } from "react";
import { truncateAddress } from "@parity/product-sdk-address";
import {
    StatementStoreClient,
    type ReceivedStatement,
} from "@parity/product-sdk-statement-store";
import type { SignerAccount } from "./utils.ts";

// The Statement Store hashes `appName` into topic1, so every session that uses
// the same appName + room (topic2) shares one ephemeral pub/sub channel. Keep
// the room fixed so all players land in the same "lobby".
const APP_NAME = "playground-emoji-wall";
const ROOM = "lobby";
const SS58_PREFIX = 42; // matches the SignerManager config in utils.ts

const EMOJIS = ["🎉", "❤️", "🚀", "👀", "🔥", "😂", "👏", "🫡"] as const;
const FEED_CAP = 60;

// Statements are tiny (512-byte hard limit) and ephemeral, so the payload is
// just the emoji, a timestamp, and a client id used to de-dupe our own
// optimistic echo against the copy the store streams back.
interface Reaction {
    e: string;
    t: number;
    id: string;
}

interface FeedItem extends Reaction {
    mine: boolean;
    signer?: string;
}

type ConnState =
    | { status: "idle" }
    | { status: "connecting" }
    | { status: "ready" }
    | { status: "error"; message: string };

let idCounter = 0;
function nextId(): string {
    idCounter += 1;
    return `${idCounter}`;
}

export default function EmojiWall({ account }: { account: SignerAccount | null }) {
    const [conn, setConn] = useState<ConnState>({ status: "idle" });
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const clientRef = useRef<StatementStoreClient | null>(null);
    const myKeyRef = useRef<string | null>(null);

    // Append to the feed, de-duping by id (our optimistic add vs. the store's
    // echo) and capping length so the list stays bounded.
    const pushReaction = (r: Reaction, opts: { mine: boolean; signer?: string }) => {
        setFeed(prev => {
            if (prev.some(item => item.id === r.id && item.signer === opts.signer)) return prev;
            const item: FeedItem = { ...r, mine: opts.mine, signer: opts.signer };
            return [item, ...prev].slice(0, FEED_CAP);
        });
    };

    useEffect(() => {
        if (!account) {
            setConn({ status: "idle" });
            return;
        }

        let cancelled = false;
        const client = new StatementStoreClient({
            appName: APP_NAME,
            // Let a reaction linger ~90s before it expires from the store.
            defaultTtlSeconds: 90,
        });
        clientRef.current = client;
        setConn({ status: "connecting" });

        (async () => {
            try {
                await client.connect({ mode: "host", accountId: [account.address, SS58_PREFIX] });
                if (cancelled) return;
                myKeyRef.current = client.getPublicKeyHex();

                // subscribe() delivers both un-expired statements already in the
                // store and new ones as they arrive (via the client's polling).
                client.subscribe<Reaction>(
                    (stmt: ReceivedStatement<Reaction>) => {
                        if (!isReaction(stmt.data)) return;
                        pushReaction(stmt.data, {
                            mine: stmt.signerHex === myKeyRef.current,
                            signer: stmt.signerHex,
                        });
                    },
                    { topic2: ROOM },
                );

                if (!cancelled) setConn({ status: "ready" });
            } catch (cause) {
                if (!cancelled) {
                    setConn({ status: "error", message: cause instanceof Error ? cause.message : String(cause) });
                }
            }
        })();

        return () => {
            cancelled = true;
            clientRef.current = null;
            client.destroy();
        };
    }, [account?.address]);

    const send = async (emoji: string) => {
        const client = clientRef.current;
        if (!client || conn.status !== "ready") return;
        const reaction: Reaction = { e: emoji, t: Date.now(), id: nextId() };
        // Optimistic: show it instantly; the store echo is de-duped by id.
        pushReaction(reaction, { mine: true, signer: myKeyRef.current ?? undefined });
        try {
            await client.publish<Reaction>(reaction, { topic2: ROOM });
        } catch (cause) {
            setConn({ status: "error", message: cause instanceof Error ? cause.message : String(cause) });
        }
    };

    return (
        <section className="wall">
            <div className="wall-heading">
                <span className="field-label">Live Emoji Wall</span>
                <span className={`wall-status wall-status-${conn.status}`}>{statusLabel(conn, account)}</span>
            </div>

            <div className="emoji-grid">
                {EMOJIS.map(emoji => (
                    <button
                        key={emoji}
                        className="emoji-btn"
                        onClick={() => send(emoji)}
                        disabled={conn.status !== "ready"}
                        title={conn.status === "ready" ? `Send ${emoji}` : "Open in a Polkadot host to react"}
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {conn.status === "error" && <p className="error">{conn.message}</p>}

            <div className="feed">
                {feed.length === 0 ? (
                    <p className="hint">
                        {account
                            ? "No reactions yet — tap an emoji to broadcast it to everyone in the room."
                            : <>Open this app in a <strong>Polkadot host</strong> to join the room and react in real time.</>}
                    </p>
                ) : (
                    feed.map(item => (
                        <div className={`feed-item${item.mine ? " mine" : ""}`} key={`${item.id}-${item.signer ?? "me"}`}>
                            <span className="feed-emoji">{item.e}</span>
                            <span className="feed-who mono">
                                {item.mine ? "you" : item.signer ? truncateAddress(item.signer) : "peer"}
                            </span>
                            <span className="feed-time">{relativeTime(item.t)}</span>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

function isReaction(data: unknown): data is Reaction {
    return (
        typeof data === "object" &&
        data !== null &&
        typeof (data as Reaction).e === "string" &&
        typeof (data as Reaction).t === "number" &&
        typeof (data as Reaction).id === "string"
    );
}

function statusLabel(conn: ConnState, account: SignerAccount | null): string {
    if (!account) return "No host";
    switch (conn.status) {
        case "connecting":
            return "Connecting…";
        case "ready":
            return "Live";
        case "error":
            return "Error";
        default:
            return "Idle";
    }
}

function relativeTime(t: number): string {
    const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (secs < 5) return "now";
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
}
