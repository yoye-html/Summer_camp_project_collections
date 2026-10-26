
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSpeechSynthesis } from '@/hooks/useSpeech';

export default function PendingApproval() {
    const { user, logout, isAuthenticated } = useAuthContext();
    const navigate = useNavigate();
    const { speak } = useSpeechSynthesis();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/');
            return;
        }

        if (user?.status === 'approved') {
            speak('Your account has been approved! Redirecting to dashboard.');
            const timeoutId = setTimeout(() => {
                if (user.role === 'admin') navigate('/admin');
                else if (user.role === 'volunteer') navigate('/volunteer-dashboard');
                else navigate('/user');
            }, 2000);

            return () => clearTimeout(timeoutId);
        }
    }, [user, navigate, isAuthenticated, speak]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative" style={{ backgroundImage: "url('/wallpaper.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {/* Background Overlay */}
            <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-0" />

            <div className="relative z-10 w-full max-w-md p-6">
                <div className="bg-card border border-border rounded-xl p-8 shadow-lg">
                    <div className="w-20 h-20 mx-auto mb-6 bg-secondary rounded-full flex items-center justify-center animate-pulse">
                        <Clock className="w-10 h-10 text-primary" />
                    </div>

                    <h1 className="text-2xl font-bold text-foreground mb-4 text-center">
                        Pending Approval
                    </h1>

                    <p className="text-muted-foreground mb-8 text-lg leading-relaxed text-center">
                        Thanks for signing up, <span className="font-semibold text-foreground">{user?.name}</span>.
                        <br /><br />
                        Your volunteer account is currently pending administrative approval. You will be notified once your account is active.
                    </p>

                    <button
                        onClick={handleLogout}
                        className="w-full py-3 px-4 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-5 h-5" /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
