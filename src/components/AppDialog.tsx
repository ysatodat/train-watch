import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

export function PressButton(props: ComponentProps<typeof Button>) {
  const { className, ...rest } = props;
  return <Button {...rest} className={typeof className === 'function' ? className : `press-button ${className || ''}`} />;
}

type AppDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
  testId?: string;
};

function DialogInner({ title, children, onClose, required, testId }: { title: string; children: ReactNode; onClose: () => void; required: boolean; testId?: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }, []);

  return (
    <Dialog className="dialog-shell" data-testid={testId}>
      <header className="dialog-header">
        <Heading slot="title" className="dialog-title" ref={headingRef} tabIndex={-1}>{title}</Heading>
        {!required && <PressButton className="dialog-close" aria-label="閉じる" onPress={onClose}>×</PressButton>}
      </header>
      <div className="dialog-body">{children}</div>
    </Dialog>
  );
}

export function AppDialog({ isOpen, onOpenChange, title, children, required = false, className = '', testId }: AppDialogProps) {
  if (!isOpen) return null;
  return (
    <ModalOverlay
      isOpen
      isDismissable={!required}
      isKeyboardDismissDisabled={required}
      onOpenChange={onOpenChange}
      className="modal-overlay"
    >
      <Modal className={`modal-card ${className}`}>
        <DialogInner title={title} onClose={() => onOpenChange(false)} required={required} testId={testId}>{children}</DialogInner>
      </Modal>
    </ModalOverlay>
  );
}
