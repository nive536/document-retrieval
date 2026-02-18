import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative w-14 h-7 rounded-full bg-muted border border-border transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label="Toggle theme"
    >
      <motion.div
        className="absolute top-0.5 w-6 h-6 rounded-full gradient-primary flex items-center justify-center shadow-md"
        animate={{ left: theme === "dark" ? "calc(100% - 1.625rem)" : "0.125rem" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {theme === "dark" ? (
          <Moon className="w-3.5 h-3.5 text-primary-foreground" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-primary-foreground" />
        )}
      </motion.div>
    </button>
  );
}
