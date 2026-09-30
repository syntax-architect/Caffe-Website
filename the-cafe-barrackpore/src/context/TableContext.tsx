import React, { createContext, useContext, useMemo } from 'react';
import { validateAndNormalizeTableNumber } from '../utils/tableValidation';

export interface TableContextType {
  tableNumber: string | null;
  isQrOrder: boolean;
  isValidTable: boolean;
  isQrValid: boolean;
  hasTableParam: boolean;
  validationError?: string;
  rawTableParam: string | null;
}

const TableContext = createContext<TableContextType>({
  tableNumber: null,
  isQrOrder: false,
  isValidTable: false,
  isQrValid: false,
  hasTableParam: false,
  rawTableParam: null,
});

interface TableProviderProps {
  children: React.ReactNode;
  initialTable?: string | null;
}

export const TableProvider: React.FC<TableProviderProps> = ({ children, initialTable }) => {
  const value = useMemo<TableContextType>(() => {
    if (typeof window === 'undefined') {
      return {
        tableNumber: null,
        isQrOrder: false,
        isValidTable: false,
        isQrValid: false,
        hasTableParam: false,
        rawTableParam: null,
      };
    }

    const pathname = window.location.pathname;
    const isQrPath = pathname === '/qr' || pathname === '/qr/';
    const searchParams = new URLSearchParams(window.location.search);
    const hasParam = searchParams.has('table') || initialTable !== undefined;
    const tableParam = initialTable !== undefined ? initialTable : searchParams.get('table');

    if (!isQrPath && !initialTable) {
      return {
        tableNumber: null,
        isQrOrder: false,
        isValidTable: false,
        isQrValid: false,
        hasTableParam: false,
        rawTableParam: null,
      };
    }

    const validation = validateAndNormalizeTableNumber(tableParam);

    return {
      tableNumber: validation.tableNumber,
      isQrOrder: true,
      isValidTable: validation.isValid,
      isQrValid: validation.isValid,
      hasTableParam: hasParam,
      validationError: validation.error,
      rawTableParam: validation.rawInput,
    };
  }, [initialTable]);

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTableContext = (): TableContextType => {
  return useContext(TableContext);
};
