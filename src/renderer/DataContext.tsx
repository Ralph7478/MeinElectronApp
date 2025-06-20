import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DataContextType {
  workbookData: any[];
  setWorkbookData: React.Dispatch<React.SetStateAction<any[]>>;
  configData: any;
  setConfigData: React.Dispatch<React.SetStateAction<any>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [workbookData, setWorkbookData] = useState<any[]>([]);
  const [configData, setConfigData] = useState<any | null>(null);

  return (
    <DataContext.Provider value={{ workbookData, setWorkbookData, configData, setConfigData }}>
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useDataContext must be used within a DataProvider');
  return context;
};
