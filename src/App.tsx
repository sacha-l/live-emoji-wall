import { useEffect } from "react";
import { truncateAddress } from "@parity/product-sdk-address";
import EmojiWall from "./EmojiWall.tsx";
import {
    signerManager,
    useResourceAllocationState,
    useSignerState,
    openExternalLink,
    type ResourceAllocationKind,
    type ResourceAllocationOutcome,
    type ResourceAllocationState,
} from "./utils.ts";

const PLAYGROUND_URL = "https://playground.dot";

export default function App() {
    const { status, selectedAccount, error } = useSignerState();

    useEffect(() => {
        signerManager.connect().then(result => {
            if (result.ok && result.value.length > 0) {
                signerManager.selectAccount(result.value[0].address);
            }
        });
    }, []);

    if (status === "connecting") {
        return <div className="spinner">Connecting...</div>;
    }

    return (
        <>
            <header>
                <h1>Polkadot Playground</h1>
                {selectedAccount && (
                    <span className={`address-chip${selectedAccount.name ? "" : " mono"}`}>
                        {selectedAccount.name ?? truncateAddress(selectedAccount.address)}
                    </span>
                )}
            </header>

            <main className="main">
                <div className="panel">
                    <EmojiWall account={selectedAccount} />
                    {selectedAccount ? (
                        <ResourceAllocationPanel />
                    ) : (
                        <p className="hint">
                            {error?.message ?? <>Open this app in a <strong>Polkadot host</strong> (Mobile, Desktop, or Web) to join via the Host API.</>}
                        </p>
                    )}
                </div>
                <ModItCard />
            </main>
        </>
    );
}

const RESOURCE_LABELS: Record<ResourceAllocationKind, string> = {
    StatementStoreAllowance: "Statement store",
    BulletinAllowance: "Bulletin",
    SmartContractAllowance: "Smart contracts",
    AutoSigning: "Auto-signing",
};

const OUTCOME_LABELS: Record<ResourceAllocationOutcome, string> = {
    Allocated: "Allocated",
    Rejected: "Rejected",
    NotAvailable: "Not available",
};

const STATUS_LABELS: Record<ResourceAllocationState["status"], string> = {
    idle: "Waiting",
    requesting: "Requesting",
    complete: "Complete",
    unavailable: "Unavailable",
    error: "Failed",
};

function ResourceAllocationPanel() {
    const allocation = useResourceAllocationState();

    return (
        <div className="resource-panel">
            <div className="resource-heading">
                <span className="field-label">Host resources</span>
                <span className={`resource-status resource-status-${allocation.status}`}>
                    {STATUS_LABELS[allocation.status]}
                </span>
            </div>
            <div className="resource-list">
                {allocation.entries.map(entry => (
                    <div className="resource-row" key={entry.resource}>
                        <span>{RESOURCE_LABELS[entry.resource]}</span>
                        <span className={`resource-badge resource-badge-${entry.outcome ?? "pending"}`}>
                            {entry.outcome ? OUTCOME_LABELS[entry.outcome] : "Pending"}
                        </span>
                    </div>
                ))}
            </div>
            {allocation.error && <p className="error">{allocation.error}</p>}
        </div>
    );
}

function ModItCard() {
    return (
        <section className="mod-card">
            <h2>What is this?</h2>
            <p>
                A mod of the <strong>Polkadot Playground template</strong> (live at{" "}
                <a
                    href={PLAYGROUND_URL}
                    onClick={e => { e.preventDefault(); openExternalLink(PLAYGROUND_URL); }}
                >playground.dot</a>) that replaces the sign demo with a real-time
                <strong> Live Emoji Wall</strong>.
            </p>
            <ul>
                <li>Every emoji you tap is published as a small signed statement over
                    <code>@parity/product-sdk-statement-store</code> — the Polkadot Statement Store (P2P pub/sub on Bulletin Chain).</li>
                <li>Every open session subscribes to the same room and streams reactions in real time. No server, no database.</li>
                <li>Uses the host's <code>StatementStoreAllowance</code> — see the resource panel below.</li>
            </ul>
        </section>
    );
}
