import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, X } from 'lucide-react';
import toast from 'react-hot-toast';
import RiderFormModal from './rider/RiderFormModal';
import RiderCollectModal from './rider/RiderCollectModal';
import RiderSettlementModals from './rider/RiderSettlementModals';
import RiderHistoryModal from './rider/RiderHistoryModal';
import { useRiderOperations } from './rider/hooks/useRiderOperations';
import RiderManagementHeader from './rider/RiderManagementHeader';
import RiderProfileCard from './rider/RiderProfileCard';

export default function RiderManagement({ onClose }: { onClose: () => void }) {
  const {
    riders,
    loading,
    showAddForm,
    setShowAddForm,
    editingRider,
    showCollectModal,
    setShowCollectModal,
    showSettleModal,
    setShowSettleModal,
    openMenuRiderId,
    setOpenMenuRiderId,
    activeLedgerRider,
    setActiveLedgerRider,
    selectedDayPerRider,
    setSelectedDayPerRider,
    fullDaySelectActive,
    setFullDaySelectActive,
    collectSubMode,
    setCollectSubMode,
    confirmModal,
    setConfirmModal,
    name,
    setName,
    phone,
    setPhone,
    vehicle,
    setVehicle,
    status,
    setStatus,
    codBalanceInit,
    setCodBalanceInit,
    isSendingOtp,
    isOtpSent,
    setIsOtpSent,
    otpInput,
    setOtpInput,
    isVerifyingOtp,
    isOtpVerified,
    setIsOtpVerified,
    riderOtpError,
    setRiderOtpError,
    riderCaptchaSolved,
    collectAmount,
    setCollectAmount,
    settlePayAmount,
    setSettlePayAmount,
    selectedRiderForOrders,
    setSelectedRiderForOrders,
    expandedOrders,
    setExpandedOrders,
    isMounted,
    handleSendOtp,
    handleVerifyOtp,
    handleSaveRider,
    resetForm,
    handleCleanRiderConsole,
    handleUnregisterRider,
    handleDeleteRiderTwoStep,
    getLast7Days,
    handleDeleteRider,
    getSelectedDayForRider,
    handleUnpaidCollectVerification,
    handlePaidCollectAndSetStatus,
    getRiderMetrics,
    handleSettleEarnings
  } = useRiderOperations();

  // Fleet Overall Summary metrics
  const totalRiders = riders.length;
  const activeRiders = riders.filter(r => r.status === 'Online').length;
  const totalUncollectedMoney = riders.reduce((sum, r) => sum + getRiderMetrics(r).liveCodBalance, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* 1. Header & Overall Fleet statistics panel */}
      <RiderManagementHeader
        onClose={onClose}
        resetForm={resetForm}
        setShowAddForm={setShowAddForm}
        totalRiders={totalRiders}
        activeRiders={activeRiders}
        totalUncollectedMoney={totalUncollectedMoney}
      />

      {/* 2. Riders Profiles List */}
      <div className="px-3 py-4 flex-1 space-y-4 overflow-y-auto [webkit-overflow-scrolling:touch] touch-pan-y pb-24">
        <div className="flex items-center justify-between px-1.5">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fleets Status</h2>
          <span className="text-[8px] font-extrabold bg-slate-250/60 px-2 py-0.5 rounded-full text-slate-500 uppercase tracking-wider">
            {riders.length} Registered
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-slate-400">
            <div className="w-7 h-7 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[9.5px] font-bold uppercase tracking-widest">Syncing Fleet Status...</p>
          </div>
        ) : riders.length === 0 ? (
          <div className="py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 text-center px-6">
            <Bike className="w-10 h-10 mx-auto text-rose-500 opacity-20 mb-3" />
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">No Delivery Riders Registered</p>
            <p className="text-[9px] text-slate-400/80 mt-1 max-w-xs mx-auto">Use the "+ Add Rider" button in the upper right header to create your logistical delivery fleet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {riders.map((rider) => {
              const metrics = getRiderMetrics(rider);
              const isSelectedMenu = openMenuRiderId === rider.id;
              
              return (
                <RiderProfileCard
                  key={rider.id}
                  rider={rider}
                  metrics={metrics}
                  isSelectedMenu={isSelectedMenu}
                  setOpenMenuRiderId={setOpenMenuRiderId}
                  setSelectedRiderForOrders={setSelectedRiderForOrders}
                  handleCleanRiderConsole={handleCleanRiderConsole}
                  handleUnregisterRider={handleUnregisterRider}
                  handleDeleteRiderTwoStep={handleDeleteRiderTwoStep}
                  getSelectedDayForRider={getSelectedDayForRider}
                  setActiveLedgerRider={setActiveLedgerRider}
                  setFullDaySelectActive={setFullDaySelectActive}
                  setShowCollectModal={setShowCollectModal}
                  setCollectAmount={setCollectAmount}
                  setCollectSubMode={setCollectSubMode}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Add/Edit Rider Form Panel */}
      <RiderFormModal
        showAddForm={showAddForm}
        setShowAddForm={setShowAddForm}
        editingRider={editingRider}
        name={name}
        setName={setName}
        phone={phone}
        setPhone={setPhone}
        isOtpVerified={isOtpVerified}
        setIsOtpVerified={setIsOtpVerified}
        isSendingOtp={isSendingOtp}
        isOtpSent={isOtpSent}
        setIsOtpSent={setIsOtpSent}
        otpInput={otpInput}
        setOtpInput={setOtpInput}
        vehicle={vehicle}
        setVehicle={setVehicle}
        status={status}
        setStatus={setStatus}
        codBalanceInit={codBalanceInit}
        setCodBalanceInit={setCodBalanceInit}
        handleSendOtp={handleSendOtp}
        handleVerifyOtp={handleVerifyOtp}
        isVerifyingOtp={isVerifyingOtp}
        handleSaveRider={handleSaveRider}
        handleDeleteRider={handleDeleteRider}
        riderOtpError={riderOtpError}
        setRiderOtpError={setRiderOtpError}
        riderCaptchaSolved={riderCaptchaSolved}
      />

      {/* MODAL 2: Collect cash balance modal with Interactive Paid/Unpaid Selection */}
      <RiderCollectModal
        showCollectModal={showCollectModal}
        setShowCollectModal={setShowCollectModal}
        getSelectedDayForRider={getSelectedDayForRider}
        getRiderMetrics={getRiderMetrics}
        collectSubMode={collectSubMode}
        setCollectSubMode={setCollectSubMode}
        collectAmount={collectAmount}
        setCollectAmount={setCollectAmount}
        handleUnpaidCollectVerification={handleUnpaidCollectVerification}
        handlePaidCollectAndSetStatus={handlePaidCollectAndSetStatus}
        isMounted={isMounted}
      />

      {/* MODAL 3: Settlement modal & MODAL 4: Full Screen Settlement Day Picker */}
      <RiderSettlementModals
        showSettleModal={showSettleModal}
        setShowSettleModal={setShowSettleModal}
        settlePayAmount={settlePayAmount}
        setSettlePayAmount={setSettlePayAmount}
        handleSettleEarnings={handleSettleEarnings}
        getRiderMetrics={getRiderMetrics}
        fullDaySelectActive={fullDaySelectActive}
        setFullDaySelectActive={setFullDaySelectActive}
        activeLedgerRider={activeLedgerRider}
        setActiveLedgerRider={setActiveLedgerRider}
        getLast7Days={getLast7Days}
        getSelectedDayForRider={getSelectedDayForRider}
        setSelectedDayPerRider={setSelectedDayPerRider}
        isMounted={isMounted}
      />

      {/* GORGEOUS CUSTOM 2-STEP CONFIRMATION MODAL */}
      {isMounted && createPortal(
        <AnimatePresence>
          {confirmModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-5 bg-slate-900/65 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="bg-white w-full max-w-sm rounded-[1.8rem] shadow-2xl border border-rose-100 overflow-hidden text-left"
              >
                {/* Cute Header based on step */}
                <div className={`p-4 text-white flex items-center justify-between ${
                  confirmModal.step === 1 
                    ? 'bg-gradient-to-r from-rose-800 to-rose-900' 
                    : 'bg-gradient-to-r from-red-850 to-red-950'
                }`}>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚠️</span> {confirmModal.title}
                    </h3>
                    <p className="text-[7.5px] text-rose-200 font-extrabold uppercase tracking-widest mt-0.5">
                      {confirmModal.step === 1 ? 'Step 1 of 2: Verification' : 'Step 2 of 2: Final Confirmation'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border-0 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Message Content */}
                <div className="p-5.5 space-y-4">
                  <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/60 relative overflow-hidden flex gap-3 text-left">
                    <div className="text-sm shrink-0">
                      {confirmModal.step === 1 ? '✨' : '🚨'}
                    </div>
                    <p className="text-[11px] font-black text-slate-705 leading-relaxed">
                      {confirmModal.step === 1 ? confirmModal.messageStep1 : confirmModal.messageStep2}
                    </p>
                  </div>

                  {/* Progress dot indicators */}
                  <div className="flex justify-center gap-1.5 py-1">
                    <span className={`w-2 h-2 rounded-full transition-all duration-300 ${confirmModal.step === 1 ? 'bg-rose-600 scale-120' : 'bg-slate-250'}`}></span>
                    <span className={`w-2 h-2 rounded-full transition-all duration-300 ${confirmModal.step === 2 ? 'bg-red-650 scale-120' : 'bg-slate-250'}`}></span>
                  </div>

                  {/* Confirm / Cancel Buttons */}
                  <div className="flex gap-2.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmModal(null)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider border border-slate-200/40 cursor-pointer transition active:scale-95"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirmModal.step === 1) {
                          setConfirmModal(prev => prev ? { ...prev, step: 2 } : null);
                          toast.success("Step 1 Clear! Please provide final approval.");
                        } else {
                          const action = confirmModal.onConfirmed;
                          setConfirmModal(null);
                          await action();
                        }
                      }}
                      className={`flex-1 text-white py-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider border-0 cursor-pointer transition active:scale-95 ${
                        confirmModal.step === 1
                          ? 'bg-rose-700 hover:bg-rose-850 shadow-sm shadow-rose-900/30'
                          : 'bg-red-800 hover:bg-red-900 shadow-sm shadow-red-950/40'
                      }`}
                    >
                      {confirmModal.step === 1 ? 'Confirm' : 'Yes, Confirm!'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* MODAL 5: Rider Delivered Orders History Details */}
      <RiderHistoryModal
        selectedRiderForOrders={selectedRiderForOrders}
        setSelectedRiderForOrders={setSelectedRiderForOrders}
        expandedOrders={expandedOrders}
        setExpandedOrders={setExpandedOrders}
        isMounted={isMounted}
      />

    </div>
  );
}
