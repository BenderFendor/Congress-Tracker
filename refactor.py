import os
import re
import glob

def refactor_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Brutalist / Old Dark Mode replacements
    content = content.replace('bg-[#0a0a0a]', 'bg-background')
    content = content.replace('bg-[#171717]', 'bg-card')
    content = content.replace('border-white/10', 'border-border')
    content = content.replace('border-white/20', 'border-border')
    content = content.replace('border-[#ff4d00]', 'border-accent')
    content = content.replace('text-[#ff4d00]', 'text-accent')
    content = content.replace('hover:border-[#ff4d00]', 'hover:border-accent')
    content = content.replace('hover:text-[#ff4d00]', 'hover:text-accent')
    content = content.replace('hover:bg-[#ff4d00]', 'hover:bg-accent hover:text-accent-foreground')
    content = content.replace('bg-[#ff4d00]', 'bg-accent text-accent-foreground')
    content = content.replace('bg-white/5', 'bg-muted')
    content = content.replace('bg-white/10', 'bg-muted/50')
    content = content.replace('bg-black/20', 'bg-muted')
    content = content.replace('bg-black', 'bg-background')
    
    # Text colors
    content = re.sub(r'\btext-gray-(400|500|600)\b', 'text-muted-foreground', content)
    # Be careful with text-white if it's meant to be text-foreground vs text-primary-foreground
    # For now, let's just do text-foreground where text-white is typically used as body color
    content = content.replace('text-white', 'text-foreground')

    # New Editorial / Hardcoded replacements
    content = content.replace('bg-[#F9F8F6]', 'bg-background')
    content = content.replace('text-[#111827]', 'text-foreground')
    content = content.replace('text-[#0B1D3A]', 'text-primary')
    content = content.replace('text-[#8B1A10]', 'text-accent')
    content = content.replace('text-[#6B7280]', 'text-muted-foreground')
    content = content.replace('bg-[#0B1D3A]', 'bg-primary text-primary-foreground')
    content = content.replace('bg-[#8B1A10]', 'bg-accent text-accent-foreground')
    content = content.replace('border-gray-200', 'border-border')
    content = content.replace('border-gray-100', 'border-border')
    content = content.replace('bg-gray-50', 'bg-muted')
    content = content.replace('bg-[#F3F4F6]', 'bg-muted')
    content = content.replace('bg-white', 'bg-card')
    
    # Typography adjustments
    # Remove brutalist uppercase/font-mono where appropriate
    content = content.replace('font-mono font-black uppercase', 'font-sans font-semibold')
    content = content.replace('font-mono text-sm font-bold uppercase', 'font-sans text-sm font-semibold')
    content = content.replace('font-mono text-xs font-bold uppercase', 'font-sans text-xs font-semibold tracking-wide')
    content = content.replace('font-mono text-xs uppercase', 'font-sans text-xs text-muted-foreground')
    content = content.replace('font-black', 'font-bold')
    content = content.replace('tracking-tighter', 'tracking-tight')
    content = content.replace('tracking-widest', 'tracking-wide')
    
    with open(filepath, 'w') as f:
        f.write(content)

files = glob.glob('frontend/app/**/*.tsx', recursive=True) + glob.glob('frontend/components/**/*.tsx', recursive=True)

for file in files:
    if 'api' not in file:
        refactor_file(file)

print(f"Refactored {len(files)} files.")
