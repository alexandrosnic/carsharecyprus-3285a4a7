import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Suspense } from "react";
import LoadingFallback from "@/components/LoadingFallback";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import FindRide from "./pages/FindRide";
import SearchResults from "./pages/SearchResults";
import RegisterRide from "./pages/RegisterRide";
import RideDetails from "./pages/RideDetails";
import BookRide from "./pages/BookRide";
import MyTrips from "./pages/MyTrips";
import RatingPage from "./pages/RatingPage";
import Chat from "./pages/Chat";
import PaymentHistory from "./pages/PaymentHistory";
import DriverVerification from "./pages/DriverVerification";
import DisputeResolution from "./pages/DisputeResolution";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback fullScreen message="Loading application..." />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/driver-verification" element={<DriverVerification />} />
                <Route path="/find-ride" element={<FindRide />} />
                <Route path="/search-results" element={<SearchResults />} />
                <Route path="/register-ride" element={<RegisterRide />} />
                <Route path="/ride/:rideId" element={<RideDetails />} />
                <Route path="/book-ride/:rideId" element={<BookRide />} />
                <Route path="/my-trips" element={<MyTrips />} />
                <Route path="/rate/:rideId" element={<RatingPage />} />
                <Route path="/chat/:rideId" element={<Chat />} />
                <Route path="/payment-history" element={<PaymentHistory />} />
                <Route path="/dispute" element={<DisputeResolution />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
