class ClipboardManager {
    copyDirectLink(noteId) {
        const directUrl = `${window.location.origin}/note/${noteId}`;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(directUrl).then(() => {
                this.showCopyFeedback();
            }).catch(() => {
                this.fallbackCopyToClipboard(directUrl);
            });
        } else {
            this.fallbackCopyToClipboard(directUrl);
        }
    }

    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyFeedback();
        } catch (err) {
            alert(`Copy failed. Direct link: ${text}`);
        } finally {
            document.body.removeChild(textArea);
        }
    }

    showCopyFeedback() {
        const btn = document.getElementById('directLinkBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1000);
    }
}

export default ClipboardManager;