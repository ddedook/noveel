"use client";

import {
  type PropsWithChildren,
  useState,
  type FC,
  isValidElement,
} from "react";
import {
  XIcon,
  PlusIcon,
  FileText,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import { Avatar, Modal, Tooltip } from "@heroui/react";
import { TooltipIconButton } from "@/app/components/assistant-ui/elements/tooltip-icon-button";
import { useAttachmentSrc } from "@/app/hooks/use-attachment-src";
import { cn } from "@/app/lib/utils";

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <img
      src={src}
      alt="Attachment preview"
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain transition-opacity duration-300 motion-reduce:transition-none",
        isLoaded
          ? "aui-attachment-preview-image-loaded opacity-100"
          : "aui-attachment-preview-image-loading opacity-0",
      )}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Modal>
      <Modal.Trigger className="aui-attachment-preview-trigger cursor-zoom-in">
        {isValidElement(children) ? (
          children
        ) : (
          <button type="button">{children}</button>
        )}
      </Modal.Trigger>
      <Modal.Backdrop>
        <Modal.Container className="sm:max-w-3xl">
          <Modal.Dialog className="aui-attachment-preview-dialog-content p-2">
            <Modal.Header>
              <Modal.Heading className="aui-sr-only sr-only">
                Image Attachment Preview
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-0">
              <div className="aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden rounded-sm">
                <AttachmentPreview src={src} />
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

const AttachmentThumb: FC = () => {
  const src = useAttachmentSrc();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <Avatar.Image
        src={src}
        alt="Attachment preview"
        className="aui-attachment-tile-image rounded-none object-cover"
      />
      <Avatar.Fallback>
        <FileText className="aui-attachment-tile-fallback-icon text-muted/80 size-6 stroke-[1.5]" />
      </Avatar.Fallback>
    </Avatar>
  );
};

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";

  const isImage = useAuiState((s) => s.attachment.type === "image");
  const typeLabel = useAuiState((s) => {
    const type = s.attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return type;
    }
  });

  const uploadState = useAuiState((s) =>
    s.attachment.status.type === "running"
      ? "uploading"
      : s.attachment.status.type === "incomplete" &&
          s.attachment.status.reason === "error"
        ? "error"
        : undefined,
  );
  const isUploading = uploadState === "uploading";
  const isError = uploadState === "error";

  const errorMessage = useAuiState((s) =>
    s.attachment.status.type === "incomplete" &&
    s.attachment.status.reason === "error"
      ? (s.attachment.status.message ?? "Upload failed")
      : undefined,
  );

  return (
    <Tooltip delay={0}>
      <AttachmentPrimitive.Root
        className={cn(
          "aui-attachment-root relative",
          isComposer &&
            "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
          isImage &&
            !isComposer &&
            "aui-attachment-root-message only:*:first:size-24",
        )}
      >
        <AttachmentPreviewDialog>
          <div
            className={cn(
              "aui-attachment-tile bg-default hover:after:bg-foreground/10 focus-visible:ring-accent/50 relative size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius,var(--radius))-var(--composer-padding,8px))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/10 after:transition-colors after:ring-inset focus-visible:ring-1 active:scale-[0.96] motion-reduce:transition-none dark:after:ring-white/10",
              isError &&
                "after:ring-danger/60 dark:after:ring-danger/60",
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.click();
              } else if (e.key === " ") {
                e.preventDefault();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " ") e.currentTarget.click();
            }}
            aria-label={`${typeLabel} attachment${
              isError ? ", upload failed" : isUploading ? ", uploading" : ""
            }`}
          >
            <AttachmentThumb />
            {isUploading && (
              <div
                aria-hidden="true"
                className="aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
              >
                <Loader2Icon className="text-muted size-4 animate-spin" />
              </div>
            )}
            {isError && (
              <div
                aria-hidden="true"
                className="aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
              >
                <AlertCircleIcon className="text-danger size-4" />
              </div>
            )}
          </div>
        </AttachmentPreviewDialog>
        {isComposer && <AttachmentRemove />}
      </AttachmentPrimitive.Root>
      <Tooltip.Content placement="top">
        <AttachmentPrimitive.Name />
        {errorMessage && (
          <p className="aui-attachment-error-message">{errorMessage}</p>
        )}
      </Tooltip.Content>
    </Tooltip>
  );
};

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Remove file"
        className="aui-attachment-tile-remove absolute end-1 top-1 size-5 rounded-full bg-black/50! text-white after:absolute after:-inset-1.5 hover:bg-black/70! hover:text-white! active:scale-[0.96] motion-reduce:transition-none"
        side="top"
      >
        <XIcon className="aui-attachment-remove-icon size-3 stroke-[2.5]" />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments>
        {() => <AttachmentUI />}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <TooltipIconButton
        tooltip="Add Attachment"
        side="bottom"
        variant="ghost"
        isIconOnly
        size="sm"
        className="aui-composer-add-attachment text-muted hover:text-foreground hover:bg-default/15 dark:border-muted/15 dark:hover:bg-default/30 size-7 rounded-full active:scale-[0.96] motion-reduce:transition-none"
        aria-label="Add Attachment"
      >
        <PlusIcon className="aui-attachment-add-icon size-4" />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
};
