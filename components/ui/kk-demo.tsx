import { ShaderBackground } from "@/components/ui/kk"

export default function ShaderBackgroundDemo() {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <ShaderBackground className="absolute inset-0" />
    </div>
  )
}
