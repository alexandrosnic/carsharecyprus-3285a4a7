import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/find-ride" element={<FindRide />} />
            <Route path="/search-results" element={<SearchResults />} />
            <Route path="/register-ride" element={<RegisterRide />} />
            <Route path="/ride/:rideId" element={<RideDetails />} />
            <Route path="/book-ride/:rideId" element={<BookRide />} />
            <Route path="/my-trips" element={<MyTrips />} />
            <Route path="/rate/:rideId" element={<RatingPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
