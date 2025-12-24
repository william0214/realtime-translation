import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Diagnostics from "./pages/Diagnostics";
import History from "./pages/History";
import Test from "./pages/Test";
import ConversationList from "./pages/ConversationList";
import ConversationDetail from "./pages/ConversationDetail";
import Simple from "./pages/Simple";
import TwoMic from "./pages/TwoMic";
import Settings from "./pages/Settings";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/diagnostics"} component={Diagnostics} />
      <Route path={"/history"} component={History} />
      <Route path={"/test"} component={Test} />
      <Route path={"/conversations"} component={ConversationList} />
      <Route path={"/conversation/:id"} component={ConversationDetail} />
      <Route path={"/simple"} component={Simple} />
      <Route path={"/two-mic"} component={TwoMic} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
