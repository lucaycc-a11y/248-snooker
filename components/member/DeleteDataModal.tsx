"use client";

import { useState } from "react";
import { X } from "lucide-react";

type DeleteDataModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  userEmail: string | null;
  hasActiveBookings: boolean;
};

/**
 * Double-confirmation modal for member data deletion (PDPO requirement A20).
 *
 * Design requirements:
 * - Two-step confirmation (not just one tap)
 * - Plain 書面語 copy stating actual consequences
 * - Confirm button uses primary brand color (green)
 * - Cancel is visually the safe/default option
 * - Shows warning if user has active bookings
 */
export default function DeleteDataModal({
  isOpen,
  onClose,
  onConfirm,
  userEmail,
  hasActiveBookings,
}: DeleteDataModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isDeleting) return; // Prevent closing during deletion
    setStep(1);
    setError(null);
    onClose();
  };

  const handleFirstConfirm = () => {
    setError(null);
    setStep(2);
  };

  const handleFinalConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      // onConfirm will handle redirect/signout; modal stays open during process
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗，請稍後再試");
      setIsDeleting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          position: "relative",
          background: "#1a1a1a",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.1)",
          maxWidth: "480px",
          width: "90%",
          padding: "32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={isDeleting}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "#A1A1A6",
            cursor: isDeleting ? "not-allowed" : "pointer",
            padding: "8px",
            opacity: isDeleting ? 0.3 : 1,
          }}
          aria-label="關閉"
        >
          <X size={20} />
        </button>

        {/* Step 1: Initial Warning */}
        {step === 1 && (
          <>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: "#f5f5f7",
                marginBottom: "16px",
              }}
            >
              刪除我的資料
            </h2>

            <div
              style={{
                fontSize: "15px",
                lineHeight: "1.6",
                color: "#A1A1A6",
                marginBottom: "24px",
              }}
            >
              <p style={{ marginBottom: "12px" }}>
                您即將要求刪除您在 Space8 的個人資料。此操作將：
              </p>
              <ul
                style={{
                  listStyle: "disc",
                  paddingLeft: "20px",
                  marginBottom: "16px",
                }}
              >
                <li>永久移除您的姓名、電話號碼及頭像</li>
                <li>刪除您帳戶內的會員積分及優惠券</li>
                <li>登出您的帳戶，您將無法再次登入</li>
                <li>
                  保留您的預約及付款記錄（用作場地營運及財務審計，符合法例要求）
                </li>
              </ul>

              {hasActiveBookings && (
                <div
                  style={{
                    background: "rgba(255, 69, 58, 0.1)",
                    border: "1px solid rgba(255, 69, 58, 0.3)",
                    borderRadius: "8px",
                    padding: "12px",
                    marginBottom: "16px",
                    color: "#FF453A",
                    fontSize: "14px",
                  }}
                >
                  ⚠️ 您目前有進行中或即將開始的預約。請先取消所有預約，方可提出刪除要求。
                </div>
              )}

              <p style={{ fontWeight: 500, color: "#f5f5f7" }}>
                此操作無法復原。
              </p>
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(255, 69, 58, 0.1)",
                  border: "1px solid rgba(255, 69, 58, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "16px",
                  color: "#FF453A",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={handleClose}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#f5f5f7",
                  fontSize: "15px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                取消
              </button>
              <button
                onClick={handleFirstConfirm}
                disabled={hasActiveBookings}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: hasActiveBookings
                    ? "rgba(255,255,255,0.1)"
                    : "#FF453A",
                  color: hasActiveBookings ? "#666" : "#fff",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: hasActiveBookings ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: hasActiveBookings ? 0.4 : 1,
                }}
              >
                繼續
              </button>
            </div>
          </>
        )}

        {/* Step 2: Final Confirmation */}
        {step === 2 && (
          <>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: "#f5f5f7",
                marginBottom: "16px",
              }}
            >
              最後確認
            </h2>

            <div
              style={{
                fontSize: "15px",
                lineHeight: "1.6",
                color: "#A1A1A6",
                marginBottom: "24px",
              }}
            >
              <p style={{ marginBottom: "12px" }}>
                確認刪除帳戶{" "}
                <strong style={{ color: "#f5f5f7" }}>{userEmail}</strong> 的個人資料？
              </p>
              <p style={{ fontWeight: 500, color: "#FF453A" }}>
                此操作將立即生效且無法復原。
              </p>
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(255, 69, 58, 0.1)",
                  border: "1px solid rgba(255, 69, 58, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "16px",
                  color: "#FF453A",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setStep(1)}
                disabled={isDeleting}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#f5f5f7",
                  fontSize: "15px",
                  fontWeight: 500,
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: isDeleting ? 0.4 : 1,
                }}
              >
                返回
              </button>
              <button
                onClick={handleFinalConfirm}
                disabled={isDeleting}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: isDeleting ? "rgba(34, 197, 94, 0.3)" : "#22C55E",
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                {isDeleting ? "處理中..." : "確認刪除"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
