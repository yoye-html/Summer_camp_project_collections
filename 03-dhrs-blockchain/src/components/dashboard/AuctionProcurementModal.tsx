import React, { useState } from "react";
import { Gavel, TrendingDown, DollarSign, Clock, ShieldCheck, X } from "lucide-react";
import { ReverseAuction } from "@/types";

interface AuctionProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctions: ReverseAuction[];
  onPlaceBid: (auctionId: number, bidAmount: number, supplierName: string) => void;
}

export const AuctionProcurementModal: React.FC<AuctionProcurementModalProps> = ({
  isOpen,
  onClose,
  auctions,
  onPlaceBid,
}) => {
  const [selectedAuctionId, setSelectedAuctionId] = useState<number>(auctions[0]?.auctionId || 1);
  const [bidAmount, setBidAmount] = useState<number>(390000);
  const [supplierName, setSupplierName] = useState("Ethiopian Pharmaceuticals Supply Agency (EPSA) Partner");
  const [bidPlacedSuccess, setBidPlacedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentAuction = auctions.find((a) => a.auctionId === selectedAuctionId) || auctions[0];

  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (bidAmount >= currentAuction.currentLowestBidETB) {
      alert("Bid must be lower than the current lowest bid in a reverse procurement auction!");
      return;
    }

    onPlaceBid(currentAuction.auctionId, bidAmount, supplierName);
    setBidPlacedSuccess(true);
    setTimeout(() => {
      setBidPlacedSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auction-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 text-slate-800 dark:text-slate-100"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <h3 id="auction-title" className="text-lg font-bold text-slate-900 dark:text-white">
                EPHI Pharmaceutical Reverse Procurement
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solidity Contract: <code className="font-mono text-teal-600 dark:text-teal-400">placeSupplyBid()</code> (Phase IV, Project 15)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {bidPlacedSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
              <TrendingDown className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">New Lowest Bid Recorded</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your bid of {bidAmount.toLocaleString()} eETB is now the winning proposal for {currentAuction.itemDescription.slice(0, 40)}...
            </p>
          </div>
        ) : (
          <div className="space-y-4 my-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Select Active Tender / Shortage Regimen
              </label>
              <select
                value={selectedAuctionId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedAuctionId(id);
                  const selected = auctions.find((a) => a.auctionId === id);
                  if (selected) {
                    setBidAmount(selected.currentLowestBidETB - 10000);
                  }
                }}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none text-slate-800 dark:text-slate-200 font-medium"
              >
                {auctions.map((auc) => (
                  <option key={auc.auctionId} value={auc.auctionId}>
                    {auc.itemDescription} ({auc.targetRegion})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Maximum Allocated Budget:</span>
                <span className="font-bold text-slate-900 dark:text-white">{currentAuction.maxBudgetETB.toLocaleString()} eETB</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Current Lowest Bid:</span>
                <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center">
                  <TrendingDown className="w-3.5 h-3.5 mr-1" />
                  {currentAuction.currentLowestBidETB.toLocaleString()} eETB
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[11px]">Current Winning Supplier:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{currentAuction.winningSupplier}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Accredited Supplier Name
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Your Descending Bid (eETB) - Must be &lt; {currentAuction.currentLowestBidETB.toLocaleString()}
                </label>
                <input
                  type="number"
                  required
                  max={currentAuction.currentLowestBidETB - 1}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none font-bold text-teal-600"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-md transition-colors"
                >
                  Broadcast Lowest Bid On-Chain
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

