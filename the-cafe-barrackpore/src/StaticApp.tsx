import React from 'react';
import { CartProvider } from './context/CartContext';
import { UIProvider } from './context/UIContext';
import { TableProvider } from './context/TableContext';
import { AppLayout } from './App';

/**
 * StaticApp renders AppLayout synchronously wrapped in providers
 * so pre-rendering / SSR produces 100% real semantic HTML that matches
 * client hydration perfectly with zero hydration errors.
 */
export const StaticApp: React.FC = () => {
  return (
    <TableProvider>
      <CartProvider>
        <UIProvider>
          <AppLayout />
        </UIProvider>
      </CartProvider>
    </TableProvider>
  );
};

export default StaticApp;
