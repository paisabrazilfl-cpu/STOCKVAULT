import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Sparkles } from "lucide-react"

export default function MrBotPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-600 rounded-full">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">MR.BOT</h1>
          <p className="text-muted-foreground">Advanced AI Trading Assistant</p>
        </div>
      </div>
      <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20">
        <CardHeader className="text-center pb-2">
          <CardTitle className="flex items-center justify-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-5 h-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center pb-8">
          <p className="text-muted-foreground max-w-md mx-auto">
            We are currently building the most powerful algorithmic trading module. 
            MR.BOT will provide real-time market analysis, automated trade execution, 
            and portfolio optimization.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 rounded-full text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Development in progress
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
