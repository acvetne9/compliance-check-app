"use client";

import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { ProgressEvent } from "@/lib/workflow/compliance-run";

interface ProgressOverlayProps {
  events: ProgressEvent[];
  isRunning: boolean;
}

export function ProgressOverlay({ events, isRunning }: ProgressOverlayProps) {
  const lastEvent = events[events.length - 1];
  const extractedEvent = events.find((e) => e.type === "requirements_extracted");
  const completedEvent = events.find((e) => e.type === "completed");
  const errorEvent = events.find((e) => e.type === "error");

  const checkingEvents = events.filter((e) => e.type === "check_complete");
  const totalRequirements =
    extractedEvent?.type === "requirements_extracted"
      ? extractedEvent.count
      : 0;
  const checkedCount = checkingEvents.length;

  const statusMessages = events
    .filter(
      (e) =>
        e.type === "extracting" ||
        e.type === "requirements_extracted" ||
        e.type === "checking"
    )
    .slice(-5);

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Spinner or status icon */}
        <div className="flex justify-center">
          {errorEvent ? (
            <AlertCircle className="size-10 text-destructive" />
          ) : completedEvent ? (
            <CheckCircle2 className="size-10 text-green-600" />
          ) : (
            <Loader2 className="size-10 animate-spin text-primary" />
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h3 className="text-base font-medium text-foreground">
            {errorEvent
              ? "Compliance Check Failed"
              : completedEvent
                ? "Compliance Check Complete"
                : "Running Compliance Check..."}
          </h3>

          {errorEvent?.type === "error" && (
            <p className="mt-1 text-sm text-destructive">{errorEvent.message}</p>
          )}

          {completedEvent?.type === "completed" && (
            <p className="mt-1 text-sm text-muted-foreground">
              {completedEvent.met} met, {completedEvent.notMet} not met,{" "}
              {completedEvent.unclear} unclear
            </p>
          )}
        </div>

        {/* Progress bar */}
        {totalRequirements > 0 && !completedEvent && !errorEvent && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Checking requirements</span>
              <span>
                {checkedCount} / {totalRequirements}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.round((checkedCount / totalRequirements) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Live status messages */}
        {isRunning && (
          <div className="space-y-1">
            {statusMessages.map((e, i) => (
              <p
                key={i}
                className={`text-xs ${
                  i === statusMessages.length - 1
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                {e.type === "extracting" && e.message}
                {e.type === "requirements_extracted" &&
                  `Found ${e.count} requirements in "${e.documentTitle}"`}
                {e.type === "checking" &&
                  `Checking: ${e.requirementText}...`}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
